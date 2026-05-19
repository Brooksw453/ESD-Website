"""
markdown_lite — a small, dependency-free Markdown -> HTML converter.

Scope is deliberately limited to the subset used by the ES Designs blog so the
output is predictable and auditable (all blog content is authored in-house):

  Block : ATX headings (## .. ######, auto id), fenced code (``` lang),
          blockquotes, unordered/ordered lists (one level of nesting via
          2-space indent), GitHub pipe tables, horizontal rules, paragraphs.
  Inline: **bold**, *italic* / _italic_, `code`, [text](url), ![alt](url).

This is NOT a general-purpose CommonMark implementation. Keep authored posts
within the documented subset (see tools/README.md). Stdlib only; Python 3.9+.
"""

import re
import html as _html

__all__ = ["convert", "slugify"]

_SLUG_RE = re.compile(r"[^a-z0-9]+")


def slugify(text):
    text = re.sub(r"<[^>]+>", "", text).lower()
    text = _SLUG_RE.sub("-", text).strip("-")
    return text or "section"


def _esc(text):
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


# ---- Inline ---------------------------------------------------------------

_CODE_SPAN = re.compile(r"`([^`]+)`")
_IMG = re.compile(r"!\[([^\]]*)\]\(([^)\s]+)(?:\s+\"([^\"]*)\")?\)")
_LINK = re.compile(r"\[([^\]]+)\]\(([^)\s]+)(?:\s+\"([^\"]*)\")?\)")
_BOLD = re.compile(r"\*\*([^*]+)\*\*")
_ITALIC = re.compile(r"(?<!\*)\*([^*\n]+)\*(?!\*)|_([^_\n]+)_")


def _external(url):
    return url.startswith("http://") or url.startswith("https://")


def inline(text):
    """Render inline Markdown in an already-trimmed text run."""
    placeholders = []

    def stash(htmlfrag):
        placeholders.append(htmlfrag)
        return "\x00%d\x00" % (len(placeholders) - 1)

    # 1. code spans (content escaped, not further processed)
    def _code(m):
        return stash("<code>%s</code>" % _esc(m.group(1)))

    text = _CODE_SPAN.sub(_code, text)

    # 2. escape everything else
    text = _esc(text)

    # 3. images
    def _img(m):
        alt, src, title = m.group(1), m.group(2), m.group(3) or ""
        t = ' title="%s"' % title if title else ""
        return stash('<img src="%s" alt="%s"%s>' % (src, alt, t))

    text = _IMG.sub(_img, text)

    # 4. links
    def _a(m):
        label, url, title = m.group(1), m.group(2), m.group(3) or ""
        attrs = ""
        if title:
            attrs += ' title="%s"' % title
        if _external(url):
            attrs += ' target="_blank" rel="noopener"'
        return stash('<a href="%s"%s>%s</a>' % (url, attrs, label))

    text = _LINK.sub(_a, text)

    # 5. bold then italic
    text = _BOLD.sub(lambda m: "<strong>%s</strong>" % m.group(1), text)

    def _it(m):
        return "<em>%s</em>" % (m.group(1) if m.group(1) is not None else m.group(2))

    text = _ITALIC.sub(_it, text)

    # 6. restore placeholders
    def _restore(m):
        return placeholders[int(m.group(1))]

    return re.sub(r"\x00(\d+)\x00", _restore, text)


# ---- Block ----------------------------------------------------------------

_HR = re.compile(r"\s*([-*_])(?:\s*\1){2,}\s*$")
_HEADING = re.compile(r"\s*(#{1,6})\s+(.*?)\s*#*\s*$")
_LIST_ITEM = re.compile(r"^(\s*)([-*+]|\d+\.)\s+(.*)$")
_TABLE_DELIM = re.compile(r"\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)+\|?\s*$")


def _starts_block(line):
    return bool(
        _HEADING.match(line)
        or _HR.match(line)
        or _LIST_ITEM.match(line)
        or line.lstrip().startswith("```")
        or line.lstrip().startswith(">")
    )


def _render_list(items):
    """items: list of (indent, marker, text, [continuation lines]). One nest level."""
    ordered = bool(re.match(r"\d+\.", items[0][1]))
    tag = "ol" if ordered else "ul"
    out = ["<%s>" % tag]
    idx = 0
    while idx < len(items):
        indent, marker, text, cont = items[idx]
        # gather nested (more-indented) items
        nested = []
        j = idx + 1
        while j < len(items) and items[j][0] > indent:
            nested.append(items[j])
            j += 1
        body = inline(text)
        if cont:
            body += " " + inline(" ".join(cont))
        if nested:
            body += _render_list([(i2 - indent, mk, tx, ct) for (i2, mk, tx, ct) in nested])
        out.append("<li>%s</li>" % body)
        idx = j
    out.append("</%s>" % tag)
    return "".join(out)


def _render_table(header, rows):
    def cells(line):
        line = line.strip()
        if line.startswith("|"):
            line = line[1:]
        if line.endswith("|"):
            line = line[:-1]
        return [c.strip() for c in line.split("|")]

    head = cells(header)
    html_out = ["<table>", "<thead><tr>"]
    for c in head:
        html_out.append("<th>%s</th>" % inline(c))
    html_out.append("</tr></thead><tbody>")
    for r in rows:
        html_out.append("<tr>")
        for c in cells(r):
            html_out.append("<td>%s</td>" % inline(c))
        html_out.append("</tr>")
    html_out.append("</tbody></table>")
    return "".join(html_out)


def convert(text):
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    lines = text.split("\n")
    n = len(lines)
    i = 0
    out = []

    while i < n:
        line = lines[i]

        if line.strip() == "":
            i += 1
            continue

        # fenced code
        stripped = line.lstrip()
        if stripped.startswith("```"):
            lang = stripped[3:].strip()
            i += 1
            code = []
            while i < n and not lines[i].lstrip().startswith("```"):
                code.append(lines[i])
                i += 1
            i += 1  # consume closing fence
            cls = ' class="language-%s"' % lang if lang else ""
            out.append("<pre><code%s>%s</code></pre>" % (cls, _esc("\n".join(code))))
            continue

        # horizontal rule
        if _HR.match(line):
            out.append("<hr>")
            i += 1
            continue

        # heading
        m = _HEADING.match(line)
        if m:
            level = len(m.group(1))
            content = m.group(2)
            hid = slugify(content)
            out.append("<h%d id=\"%s\">%s</h%d>" % (level, hid, inline(content), level))
            i += 1
            continue

        # blockquote
        if stripped.startswith(">"):
            buf = []
            while i < n and lines[i].lstrip().startswith(">"):
                buf.append(re.sub(r"^\s*>\s?", "", lines[i]))
                i += 1
            inner = convert("\n".join(buf))
            out.append("<blockquote>%s</blockquote>" % inner)
            continue

        # pipe table
        if "|" in line and i + 1 < n and _TABLE_DELIM.match(lines[i + 1]):
            header = line
            i += 2  # skip header + delimiter
            rows = []
            while i < n and lines[i].strip() != "" and "|" in lines[i]:
                rows.append(lines[i])
                i += 1
            out.append(_render_table(header, rows))
            continue

        # list (collects contiguous list items + simple continuations)
        if _LIST_ITEM.match(line):
            items = []
            while i < n:
                lm = _LIST_ITEM.match(lines[i])
                if lm:
                    indent = len(lm.group(1).replace("\t", "  "))
                    items.append([indent, lm.group(2), lm.group(3), []])
                    i += 1
                elif lines[i].strip() != "" and not _starts_block(lines[i]) and items:
                    items[-1][3].append(lines[i].strip())
                    i += 1
                else:
                    break
            out.append(_render_list([(a, b, c, d) for a, b, c, d in items]))
            continue

        # paragraph
        buf = []
        while i < n and lines[i].strip() != "" and not _starts_block(lines[i]):
            buf.append(lines[i].strip())
            i += 1
        out.append("<p>%s</p>" % inline(" ".join(buf)))

    return "\n".join(out)
