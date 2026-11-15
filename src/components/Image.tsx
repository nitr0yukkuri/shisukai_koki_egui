const img = (name: string) => "./figma/" + name;

export function Image({ name, alt = "", className }: { name: string; alt?: string; className?: string }) {
  return <img src={img(name)} alt={alt} className={className} />;
}
