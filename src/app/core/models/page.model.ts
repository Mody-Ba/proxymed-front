/** Page de resultats renvoyee par les services PROXYMED (PageResponse). page commence a 0. */
export interface PageResponse<T> {
  elements: T[];
  page: number;
  taille: number;
  totalElements: number;
  totalPages: number;
}

/**
 * Page du service d'authentification (son PageResponse) : meme forme, mais la liste s'appelle
 * "contenu" et non "elements".
 */
export interface PageContenuResponse<T> {
  contenu: T[];
  page: number;
  taille: number;
  totalElements: number;
  totalPages: number;
}
