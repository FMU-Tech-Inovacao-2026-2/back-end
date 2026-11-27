import { auditoriaNula, type Auditoria } from '../../lib/auditoria';
import { signJwt } from '../../lib/jwt';
import { verifyPassword, hashPassword } from '../../lib/password';
import { unauthorized } from '../../lib/errors';
import type { UserRepository } from '../users/user.repository';
import { toPublicUser, type PublicUser } from '../users/user.model';
import type { LoginInput } from './auth.schema';

export interface AuthConfig {
  jwtSecret: string;
  expiresInSeconds: number;
}

export interface LoginResult {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: PublicUser;
}

export class AuthService {
  // hash falso para gastar o mesmo tempo quando o e-mail não existe (evita enumeração por tempo)
  private dummyHash: Promise<string> = hashPassword('senha-inexistente');

  constructor(
    private readonly users: UserRepository,
    private readonly config: AuthConfig,
    private readonly auditoria: Auditoria = auditoriaNula,
  ) {}

  async login({ email, senha }: LoginInput): Promise<LoginResult> {
    const user = await this.users.findByEmail(email);
    const ok = await verifyPassword(senha, user ? user.senhaHash : await this.dummyHash);

    // mesma mensagem para e-mail inexistente, senha errada ou usuário inativo
    if (!user || !ok || !user.ativo) {
      this.auditoria.registrar('auth.login_falha', { usuario_id: user?.id ?? null });
      throw unauthorized('E-mail ou senha inválidos');
    }

    const accessToken = signJwt(
      { sub: user.id, role: user.role },
      this.config.jwtSecret,
      this.config.expiresInSeconds,
    );

    this.auditoria.registrar('auth.login_sucesso', { usuario_id: user.id, perfil: user.role });
    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: this.config.expiresInSeconds,
      user: toPublicUser(user),
    };
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.users.findById(userId);
    if (!user || !user.ativo) throw unauthorized();
    return toPublicUser(user);
  }
}
