import DOMPurify from 'dompurify';

export interface ISanitizerAdapter {
  sanitize(dirtyHtml: string): string;
}

export class HtmlSanitizerAdapter implements ISanitizerAdapter {
  sanitize(dirtyHtml: string): string {
    return DOMPurify.sanitize(dirtyHtml, {
      ADD_TAGS: ['aside', 'mark', 'input'],
      ADD_ATTR: ['data-alert-type', 'role', 'aria-label', 'checked', 'disabled', 'type', 'id', 'class'],
    });
  }
}
