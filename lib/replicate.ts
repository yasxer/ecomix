import "server-only";
import { type ImageRatio } from "./types";

/**
 * Génération des visuels de sections chez Replicate.
 *
 * Le modèle retenu, `google/nano-banana` (Gemini 2.5 Flash Image), est un
 * modèle d'*édition* : on lui donne les photos du produit et il ne repeint que
 * la scène autour. Un modèle de génération pure (Flux, SDXL…) inventerait un
 * autre produit — une autre montre, un autre flacon — et la page mentirait sur
 * ce qu'elle vend.
 *
 * La consigne de préservation n'est pas laissée au rédacteur : elle est
 * ajoutée ici, autour de la scène demandée. Même une consigne mal écrite ne
 * peut donc pas autoriser le modèle à redessiner le produit.
 */

const MODEL = "google/nano-banana";
const ENDPOINT = `https://api.replicate.com/v1/models/${MODEL}/predictions`;

/** Secondes que l'API garde la requête ouverte avant de rendre la main. */
const WAIT = 50;
/** Puis on interroge la prédiction, sans dépasser le temps d'une requête serveur. */
const POLL_TRIES = 3;
const POLL_DELAY = 3000;

/** Photos de référence envoyées au modèle. Trois angles suffisent à le cadrer. */
const MAX_REFERENCES = 3;

/**
 * Ce que le modèle n'a pas le droit de faire. Formulé en anglais : c'est la
 * langue dans laquelle ces modèles obéissent le mieux, et cette chaîne n'est
 * jamais montrée à personne.
 */
const PRESERVE = [
  "Use the product from the reference photos exactly as it is.",
  "Do not redesign, restyle, recolour, reshape or replace it.",
  "Keep the identical shape, proportions, materials, finish, colours, markings, dial, buttons, engravings and brand logo.",
  "Do not add or remove any part of the product.",
  "Only build the scene around it:",
].join(" ");

/**
 * Aucun texte dans l'image : les titres arabes vivent en HTML par-dessus. Les
 * générateurs d'images écrivent l'arabe en lettres détachées et inversées, et
 * un mot mal formé sur un visuel décrédibilise toute la page.
 */
const NO_TEXT =
  "Photorealistic commercial product photography, sharp focus on the product, natural lighting, high detail. Absolutely no text, no words, no letters, no numbers, no captions, no watermarks and no added logos anywhere in the image. Leave calm, uncluttered negative space around the product, especially across the lower third of the frame, where a headline will be placed afterwards.";

export function buildPrompt(scene: string): string {
  return `${PRESERVE} ${scene.trim()}. ${NO_TEXT}`;
}

type Prediction = {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: unknown;
  error?: unknown;
};

async function call(path: string, init: RequestInit): Promise<Prediction> {
  const response = await fetch(path, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    // Replicate décrit précisément les erreurs de schéma : on les remonte
    // telles quelles plutôt que de les remplacer par « échec ».
    const detail =
      (body && typeof body === "object" && "detail" in body && String(body.detail)) || "";
    throw new Error(`Replicate ${response.status}${detail ? ` : ${detail}` : ""}`);
  }
  return body as Prediction;
}

/** L'URL de sortie, que le modèle rende une chaîne ou une liste d'une entrée. */
function outputUrl(output: unknown): string | null {
  if (typeof output === "string") return output;
  if (Array.isArray(output) && typeof output[0] === "string") return output[0];
  return null;
}

/**
 * Compose un visuel de section à partir des photos du produit.
 * Rend l'URL temporaire de Replicate : elle expire, l'appelant doit la
 * rapatrier dans notre bucket.
 */
export async function generateSceneImage({
  scene,
  references,
  ratio,
}: {
  scene: string;
  references: string[];
  ratio: ImageRatio;
}): Promise<string> {
  if (!process.env.REPLICATE_API_TOKEN) {
    throw new Error(
      "REPLICATE_API_TOKEN manquant : ajoutez-le à vos variables d'environnement."
    );
  }
  if (references.length === 0) {
    throw new Error("Aucune photo produit à donner comme référence.");
  }

  let prediction = await call(ENDPOINT, {
    method: "POST",
    headers: { Prefer: `wait=${WAIT}`, "Cancel-After": "2m" },
    body: JSON.stringify({
      input: {
        prompt: buildPrompt(scene),
        image_input: references.slice(0, MAX_REFERENCES),
        aspect_ratio: ratio,
        output_format: "jpg",
      },
    }),
  });

  // `Prefer: wait` rend la main au bout de son délai, terminé ou non.
  for (let i = 0; i < POLL_TRIES && (prediction.status === "starting" || prediction.status === "processing"); i++) {
    await new Promise((resolve) => setTimeout(resolve, POLL_DELAY));
    prediction = await call(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
      method: "GET",
    });
  }

  if (prediction.status === "failed" || prediction.status === "canceled") {
    throw new Error(
      `Génération refusée${prediction.error ? ` : ${String(prediction.error)}` : ""}.`
    );
  }

  const url = outputUrl(prediction.output);
  if (!url) throw new Error("Le générateur d'images a mis trop de temps. Réessayez.");
  return url;
}
