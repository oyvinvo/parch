export interface DiagramRenderResult {
  success: boolean;
  svgHtml?: string;
  errorMessage?: string;
  rawCode: string;
}

export interface MathRenderResult {
  success: boolean;
  renderedHtml: string;
  isBlock: boolean;
  rawFormula: string;
}
