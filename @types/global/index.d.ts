import type { SvgIconComponent } from '@material-ui/icons';

declare global {
  type SvgComponent =
    | SvgIconComponent
    | React.FunctionComponent<
        React.SVGProps<SVGSVGElement> & { title?: string }
      >;
}
