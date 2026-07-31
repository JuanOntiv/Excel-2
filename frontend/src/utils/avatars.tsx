import { Cat, Dog, Rabbit, Bird, Fish, Turtle, Squirrel, Panda } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface AvatarOption {
  key: string;
  label: string;
  icon: LucideIcon;
}

// Lista fija de avatares predefinidos (iconos como placeholder mientras no
// haya assets propios). avatar_key solo guarda esta clave, no una URL.
export const AVATAR_OPTIONS: AvatarOption[] = [
  { key: "cat", label: "Gato", icon: Cat },
  { key: "dog", label: "Perro", icon: Dog },
  { key: "rabbit", label: "Conejo", icon: Rabbit },
  { key: "bird", label: "Pájaro", icon: Bird },
  { key: "fish", label: "Pez", icon: Fish },
  { key: "turtle", label: "Tortuga", icon: Turtle },
  { key: "squirrel", label: "Ardilla", icon: Squirrel },
  { key: "panda", label: "Panda", icon: Panda },
];

export function getAvatarIcon(key: string | null | undefined): LucideIcon | null {
  return AVATAR_OPTIONS.find((a) => a.key === key)?.icon ?? null;
}
