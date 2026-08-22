/**
 * Upload direct navigateur → Supabase, partagé par le formulaire produit et
 * l'éditeur de packs. Les deux envoient leurs images via une URL signée
 * obtenue du serveur : aucun octet ne transite par Next, ce qui lève la limite
 * de taille des Server Actions.
 *
 * Module client — pas de `server-only` ici, contrairement au reste de `lib/`.
 */

/** Exécute `task` sur chaque élément, `limit` en parallèle au maximum. */
export async function mapLimit<T>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<void>
): Promise<void> {
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) await task(items[cursor++]);
    })
  );
}

/**
 * Envoie le fichier directement à Supabase via l'URL signée. On passe par
 * XMLHttpRequest et non `fetch` : lui seul expose la progression d'upload.
 */
export function putToSignedUrl(
  signedUrl: string,
  file: File,
  onProgress: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("content-type", file.type);
    xhr.setRequestHeader("cache-control", "max-age=31536000");
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload refusé (${xhr.status})`));
    });
    xhr.addEventListener("error", () => reject(new Error("Connexion interrompue")));
    xhr.addEventListener("abort", () => reject(new Error("Upload annulé")));
    xhr.send(file);
  });
}
