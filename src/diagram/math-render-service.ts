import { IKatexAdapter } from './katex-adapter.ts';

export class MathRenderService {
  private adapter: IKatexAdapter;

  constructor(adapter: IKatexAdapter) {
    this.adapter = adapter;
  }

  renderMathInContainer(container: HTMLElement): void {
    const textNodes = this.collectCandidateTextNodes(container);

    for (const node of textNodes) {
      const text = node.nodeValue || '';
      if (text.includes('$')) {
        this.replaceMathInTextNode(node, text);
      }
    }
  }

  private collectCandidateTextNodes(root: Node): Text[] {
    const textNodes: Text[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let currentNode = walker.nextNode();

    while (currentNode) {
      if (this.isEligibleTextNode(currentNode)) {
        textNodes.push(currentNode as Text);
      }
      currentNode = walker.nextNode();
    }

    return textNodes;
  }

  private isEligibleTextNode(node: Node): boolean {
    const parent = node.parentElement;
    return !parent || (parent.tagName !== 'CODE' && parent.tagName !== 'PRE');
  }

  private replaceMathInTextNode(node: Text, text: string): void {
    const mathRegex = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
    let match: RegExpExecArray | null = mathRegex.exec(text);
    if (!match) {
      return;
    }

    const fragment = document.createDocumentFragment();
    let lastIndex = 0;

    while (match !== null) {
      if (match.index > lastIndex) {
        fragment.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
      }

      const { isBlock, expression } = this.parseMathMatch(match);
      const mathNode = this.createRenderedMathNode(expression, isBlock);
      fragment.appendChild(mathNode);

      lastIndex = mathRegex.lastIndex;
      match = mathRegex.exec(text);
    }

    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
    }

    node.parentNode?.replaceChild(fragment, node);
  }

  private parseMathMatch(match: RegExpExecArray): { isBlock: boolean; expression: string } {
    const isBlock = match[1] !== undefined;
    const expression = (isBlock ? match[1] : match[2]) || '';
    return { isBlock, expression };
  }

  private createRenderedMathNode(expression: string, isBlock: boolean): Node {
    const renderedHtml = this.adapter.renderToString(expression, {
      displayMode: isBlock,
      throwOnError: false,
      errorColor: '#cc0000',
    });

    const wrapper = document.createElement('div');
    wrapper.innerHTML = renderedHtml;

    const fragment = document.createDocumentFragment();
    while (wrapper.firstChild) {
      fragment.appendChild(wrapper.firstChild);
    }
    return fragment;
  }
}
