import { useWindowDimensions } from 'react-native';
import { breakpoints, grid, type Breakpoint } from '../tokens';

export function getBreakpoint(width: number): Breakpoint {
  if (width >= breakpoints.expanded) return 'expanded';
  if (width >= breakpoints.medium) return 'medium';
  return 'compact';
}

/** คืนค่า grid ปัจจุบัน + ฟังก์ชันคำนวณความกว้างตามจำนวน column */
export function useGrid() {
  const { width } = useWindowDimensions();
  const bp = getBreakpoint(width);
  const g = grid[bp];
  const contentWidth = Math.min(width, g.maxContentWidth) - g.margin * 2;
  const columnWidth = (contentWidth - g.gutter * (g.columns - 1)) / g.columns;
  const span = (cols: number) => columnWidth * cols + g.gutter * (cols - 1);
  return { breakpoint: bp, ...g, contentWidth, columnWidth, span };
}
