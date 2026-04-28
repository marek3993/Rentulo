import type { ReactNode } from "react";

type ItemPreviewImageProps = {
  src?: string | null;
  alt: string;
  frameClassName?: string;
  imageWrapperClassName?: string;
  imageClassName?: string;
  fallbackClassName?: string;
  fallbackLabel?: string;
  fit?: "contain" | "cover";
  children?: ReactNode;
};

function mergeClasses(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function ItemPreviewImage({
  src,
  alt,
  frameClassName,
  imageWrapperClassName,
  imageClassName,
  fallbackClassName,
  fallbackLabel = "Bez fotky",
  fit = "contain",
  children,
}: ItemPreviewImageProps) {
  return (
    <div className={mergeClasses("relative overflow-hidden bg-black/20", frameClassName)}>
      {src ? (
        <div
          className={mergeClasses(
            "h-full w-full",
            fit === "contain" ? "p-2 sm:p-3" : "",
            imageWrapperClassName
          )}
        >
          <img
            src={src}
            alt={alt}
            className={mergeClasses(
              "h-full w-full object-center",
              fit === "contain" ? "object-contain" : "object-cover",
              imageClassName
            )}
          />
        </div>
      ) : (
        <div
          className={mergeClasses(
            "flex h-full w-full items-center justify-center text-sm text-white/40",
            fallbackClassName
          )}
        >
          {fallbackLabel}
        </div>
      )}

      {children}
    </div>
  );
}
