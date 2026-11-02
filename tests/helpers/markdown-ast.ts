import { unified } from 'unified';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { visit } from 'unist-util-visit';

type AstNode = {
  type: string;
  lang?: string | null;
  checked?: boolean | null;
  children?: AstNode[];
  [key: string]: unknown;
};

const markdownProcessor = unified().use(remarkParse).use(remarkGfm);

/** Parse generated Markdown independently and expose its semantic AST nodes to tests. */
export function parseMarkdownAst(markdown: string): AstNode[] {
  const tree = markdownProcessor.parse(markdown);
  const nodes: AstNode[] = [];

  visit(tree, (node) => {
    nodes.push(node as AstNode);
  });

  return nodes;
}

export function nodesOfType(nodes: AstNode[], type: string): AstNode[] {
  return nodes.filter((node) => node.type === type);
}
