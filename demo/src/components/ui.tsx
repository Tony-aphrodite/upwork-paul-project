import clsx from "clsx";
import Image from "next/image";
import logo from "@/brand/logo.png";

/**
 * The client's logo artwork (from client-files/brand, trimmed). The brand guide asks for at least 220 px wide where the
 * brand is shown to families; the navigator screens use a smaller size in their header.
 */
export const Logo = ({ width = 220 }: { width?: number }) => (
  <Image src={logo} alt="Ageing Navigator" width={width} height={Math.round(width / (logo.width / logo.height))} priority className="block h-auto max-w-full" style={{ width }} />
);
