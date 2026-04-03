import "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "tv-economic-map": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & { theme?: string },
        HTMLElement
      >;
    }
  }
}
