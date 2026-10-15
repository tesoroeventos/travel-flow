export interface Ctx {
  userId: string;
  workspaceId: string;
}

export class NotFoundError extends Error {
  constructor(entity: string, id: string) {
    super(`No se encontró ${entity} ${id}`);
    this.name = "NotFoundError";
  }
}
