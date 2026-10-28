export type AlertType = 'note' | 'tip' | 'important' | 'warning' | 'caution';

export interface AlertMetadata {
  type: AlertType;
  title: string;
  iconSvg: string;
}

export class AlertCalloutBuilder {
  private readonly metadataMap: Record<AlertType, AlertMetadata> = {
    note: {
      type: 'note',
      title: 'Note',
      iconSvg: '<svg class="octicon octicon-info" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 7.75A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75ZM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"></path></svg>',
    },
    tip: {
      type: 'tip',
      title: 'Tip',
      iconSvg: '<svg class="octicon octicon-light-bulb" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M8 1.5c-2.363 0-4 1.69-4 3.75 0 .984.424 1.625.984 2.304l.214.253c.223.264.47.556.673.91.324.567.405 1.13.405 1.783v.5a.75.75 0 0 0 .75.75h2a.75.75 0 0 0 .75-.75v-.5c0-.653.08-1.216.405-1.783.203-.354.45-.646.673-.91l.214-.253c.56-.679.984-1.32.984-2.304 0-2.06-1.637-3.75-4-3.75ZM6.25 13a.75.75 0 0 0 0 1.5h3.5a.75.75 0 0 0 0-1.5h-3.5Z"></path></svg>',
    },
    important: {
      type: 'important',
      title: 'Important',
      iconSvg: '<svg class="octicon octicon-report" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v9.5A1.75 1.75 0 0 1 14.25 13H8.06l-2.573 2.573A1.458 1.458 0 0 1 3 14.543V13H1.75A1.75 1.75 0 0 1 0 11.25Zm1.75-.25a.25.25 0 0 0-.25.25v9.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h6.5a.25.25 0 0 0 .25-.25v-9.5a.25.25 0 0 0-.25-.25Zm7 2.25v4a.75.75 0 0 1-1.5 0v-4a.75.75 0 0 1 1.5 0ZM8 10.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"></path></svg>',
    },
    warning: {
      type: 'warning',
      title: 'Warning',
      iconSvg: '<svg class="octicon octicon-alert" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"></path></svg>',
    },
    caution: {
      type: 'caution',
      title: 'Caution',
      iconSvg: '<svg class="octicon octicon-stop" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M4.47.047A.75.75 0 0 1 5 0h6a.75.75 0 0 1 .53.22l4.25 4.25c.141.14.22.331.22.53v6a.75.75 0 0 1-.22.53l-4.25 4.25A.75.75 0 0 1 11 16H5a.75.75 0 0 1-.53-.22L.22 11.53A.75.75 0 0 1 0 11V5a.75.75 0 0 1 .22-.53Zm.843 1.453L1.5 5.31v5.38l3.813 3.813h5.374l3.813-3.813V5.31L10.687 1.5ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"></path></svg>',
    },
  };

  getAlertMetadata(type: AlertType): AlertMetadata | null {
    return this.metadataMap[type] ?? null;
  }

  enhanceContainer(container: HTMLElement): void {
    const alertElements = container.querySelectorAll<HTMLElement>('.markdown-alert');

    alertElements.forEach((alert) => {
      const type = alert.getAttribute('data-alert-type') as AlertType;
      const metadata = this.getAlertMetadata(type);
      if (!metadata) {
        return;
      }

      alert.setAttribute('role', 'region');
      alert.setAttribute('aria-label', metadata.title);

      if (!alert.querySelector('.markdown-alert-title')) {
        const titleElement = document.createElement('div');
        titleElement.className = 'markdown-alert-title';
        titleElement.innerHTML = `${metadata.iconSvg}<span>${metadata.title}</span>`;
        alert.prepend(titleElement);
      }
    });
  }
}
