import katex from 'katex';

export interface IKatexAdapter {
  renderToString(expression: string, options: { displayMode: boolean; throwOnError: boolean; errorColor: string }): string;
}

export class KatexAdapter implements IKatexAdapter {
  renderToString(expression: string, options: { displayMode: boolean; throwOnError: boolean; errorColor: string }): string {
    return katex.renderToString(expression, options);
  }
}
