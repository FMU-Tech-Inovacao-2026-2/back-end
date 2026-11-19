export type Role = 'profissional' | 'paciente';

export interface User {
  id: string;
  nome: string;
  email: string;
  senhaHash: string;
  role: Role;
  ativo: boolean;
}

/** O que pode sair da API. Nunca inclui senhaHash. */
export type PublicUser = Pick<User, 'id' | 'nome' | 'email' | 'role'>;

export const toPublicUser = (u: User): PublicUser => ({
  id: u.id,
  nome: u.nome,
  email: u.email,
  role: u.role,
});
