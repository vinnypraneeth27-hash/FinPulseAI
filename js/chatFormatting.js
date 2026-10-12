function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderInlineMarkdown(value) {
  return escapeHtml(value).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

export function escapeChatAttribute(value) {
  return escapeHtml(value);
}

export function renderChatMarkdown(value) {
  const lines = String(value || '').replace(/\r\n?/g, '\n').split('\n');
  const output = [];
  let orderedListOpen = false;
  let orderedItemOpen = false;
  let unorderedListOpen = false;

  const closeUnordered = () => {
    if (unorderedListOpen) {
      output.push('</ul>');
      unorderedListOpen = false;
    }
  };
  const closeOrderedItem = () => {
    closeUnordered();
    if (orderedItemOpen) {
      output.push('</li>');
      orderedItemOpen = false;
    }
  };
  const closeLists = () => {
    closeOrderedItem();
    if (orderedListOpen) {
      output.push('</ol>');
      orderedListOpen = false;
    }
    closeUnordered();
  };

  for (const line of lines) {
    const numbered = line.match(/^\s*\d+\.\s+(.+)$/);
    const bullet = line.match(/^\s*[-*•]\s+(.+)$/);

    if (numbered) {
      closeOrderedItem();
      if (!orderedListOpen) {
        output.push('<ol>');
        orderedListOpen = true;
      }
      output.push(`<li>${renderInlineMarkdown(numbered[1])}`);
      orderedItemOpen = true;
    } else if (bullet) {
      if (!unorderedListOpen) {
        output.push('<ul>');
        unorderedListOpen = true;
      }
      output.push(`<li>${renderInlineMarkdown(bullet[1])}</li>`);
    } else {
      closeLists();
      if (line.trim()) output.push(`<p>${renderInlineMarkdown(line)}</p>`);
    }
  }

  closeLists();
  return output.join('');
}
