import {
  Award, Baby, BadgeCheck, Banknote, Battery, Bell, Bike, Box, Brush, Camera, Car, Check,
  CircleCheck, CircleX, Clock, Coffee, CreditCard, Crown, Droplets, Dumbbell, Eye, Feather,
  Flame, Frown, Gem, Gift, Handshake, Headphones, Heart, Home, Hourglass, Infinity as InfinityIcon,
  Layers, Leaf, Lightbulb, Lock, MapPin, Moon, Package, Palette, Phone, Quote, Recycle, RefreshCw,
  Ruler, Scale, Scissors, ShieldCheck, Shirt, Smile, Sofa, Sparkles, Star, Sun, Tag, Target,
  Thermometer, ThumbsDown, ThumbsUp, Timer, TrendingUp, TriangleAlert, Truck, Users, Utensils,
  Volume2, Wand, Watch, Waves, Weight, Wifi, Wind, Wrench, Zap,
} from "lucide-react";
import type { LandingIcon } from "@/lib/types";

/**
 * Correspondance entre les noms d'icônes stockés en base et les composants.
 *
 * Les noms sont volontairement neutres ("shield" plutôt que "ShieldCheck") :
 * ils survivent à un renommage dans lucide, et une page enregistrée il y a six
 * mois continue d'afficher la même icône. La table est exhaustive sur
 * `LandingIcon`, donc ajouter un nom dans `LANDING_ICONS` sans l'illustrer ici
 * casse la compilation plutôt que le rendu.
 */
const ICONS: Record<LandingIcon, typeof Check> = {
  shield: ShieldCheck, lock: Lock, "badge-check": BadgeCheck, award: Award, crown: Crown, gem: Gem,
  droplets: Droplets, waves: Waves, thermometer: Thermometer, wind: Wind, leaf: Leaf, recycle: Recycle,
  zap: Zap, battery: Battery, wifi: Wifi, volume: Volume2, headphones: Headphones, camera: Camera,
  watch: Watch, timer: Timer, clock: Clock, hourglass: Hourglass, infinity: InfinityIcon, refresh: RefreshCw,
  truck: Truck, package: Package, box: Box, layers: Layers, "map-pin": MapPin, phone: Phone,
  banknote: Banknote, "credit-card": CreditCard, tag: Tag, gift: Gift, handshake: Handshake, users: Users,
  star: Star, heart: Heart, sparkles: Sparkles, flame: Flame, lightbulb: Lightbulb, target: Target,
  check: Check, "check-circle": CircleCheck, "x-circle": CircleX, alert: TriangleAlert,
  "thumbs-up": ThumbsUp, "thumbs-down": ThumbsDown,
  smile: Smile, frown: Frown, eye: Eye, bell: Bell, quote: Quote, "trending-up": TrendingUp,
  scale: Scale, ruler: Ruler, weight: Weight, wrench: Wrench, scissors: Scissors, brush: Brush,
  palette: Palette, wand: Wand, shirt: Shirt, sofa: Sofa, baby: Baby, dumbbell: Dumbbell,
  bike: Bike, car: Car, home: Home, utensils: Utensils, coffee: Coffee, feather: Feather,
  sun: Sun, moon: Moon,
};

/** Icône d'une puce de landing, désignée par son nom stocké. */
export function BlockIcon({
  name,
  className = "size-5",
}: {
  name: LandingIcon;
  className?: string;
}) {
  const Icon = ICONS[name];
  return <Icon className={className} aria-hidden="true" />;
}
