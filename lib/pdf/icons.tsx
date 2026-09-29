import { Svg, Path, Rect, Circle, Line } from "@react-pdf/renderer";

/**
 * Simple line icons for the letterhead footer (phone/email/website).
 * Deliberately built from basic primitives (Rect/Circle/Line/simple Path
 * curves) rather than recited icon-font path data, since react-pdf can't
 * render icon fonts (Lucide etc.) and a subtly-wrong complex bezier path
 * copied from memory is a real risk - these are simple enough to reason
 * about directly.
 */
interface IconProps {
  size?: number;
  color?: string;
}

export function PhoneIcon({ size = 8, color = "#888888" }: IconProps) {
  return (
    <Svg width={size} height={(size * 18) / 14} viewBox="0 0 14 18">
      <Rect x={1.5} y={1} width={11} height={16} rx={2} stroke={color} strokeWidth={1.3} fill="none" />
      <Circle cx={7} cy={14.5} r={0.9} fill={color} />
    </Svg>
  );
}

export function MailIcon({ size = 8, color = "#888888" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18">
      <Rect x={1} y={3} width={16} height={12} rx={1.5} stroke={color} strokeWidth={1.3} fill="none" />
      <Path d="M1.5 4 L9 11 L16.5 4" stroke={color} strokeWidth={1.3} fill="none" />
    </Svg>
  );
}

export function GlobeIcon({ size = 8, color = "#888888" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18">
      <Circle cx={9} cy={9} r={7.5} stroke={color} strokeWidth={1.3} fill="none" />
      <Line x1={1.5} y1={9} x2={16.5} y2={9} stroke={color} strokeWidth={1.3} />
      <Path d="M9 1.5 C 13 5, 13 13, 9 16.5 C 5 13, 5 5, 9 1.5 Z" stroke={color} strokeWidth={1.3} fill="none" />
    </Svg>
  );
}
