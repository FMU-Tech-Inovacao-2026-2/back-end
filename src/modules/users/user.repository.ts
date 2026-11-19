import { hashPassword } from '../../lib/password';
import type { User } from './user.model';

/**
 * Contrato de acesso a usuários. Hoje há só a implementação em memória;
 * quando o Supabase entrar, basta criar outra classe que implemente esta interface.
 */
export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
}

export class InMemoryUserRepository implements UserRepository {
  private readonly users: User[];

  constructor(users: User[] = []) {
    this.users = users;
  }

  async findByEmail(email: string) {
    const e = email.trim().toLowerCase();
    return this.users.find((u) => u.email === e) ?? null;
  }

  async findById(id: string) {
    return this.users.find((u) => u.id === id) ?? null;
  }
}

/** Usuários FICTÍCIOS para desenvolvimento. Nunca usados em produção. */
export async function buildDevRepository(): Promise<InMemoryUserRepository> {
  return new InMemoryUserRepository([
    {
      id: 'u-001',
      nome: 'Dra. Ana Demo',
      email: 'medica@demo.altaassistida.dev',
      senhaHash: await hashPassword('Demo@12345'),
      role: 'profissional',
      ativo: true,
    },
    {
      id: 'u-002',
      nome: 'Paciente Demo',
      email: 'paciente@demo.altaassistida.dev',
      senhaHash: await hashPassword('Demo@12345'),
      role: 'paciente',
      ativo: true,
    },
  ]);
}
