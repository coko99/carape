import Image from "next/image";

export function BrandMark({
  className = "h-[4.5rem] w-auto",
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/brand/logo.png"
      alt="ŽA-JO KOMERC"
      width={618}
      height={404}
      priority={priority}
      className={className}
    />
  );
}
