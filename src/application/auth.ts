import { naoAutenticado } from '../domain/erros';
import { toPublicUser, type PublicUser } from '../domain/usuario';
import { auditoriaNula, type Auditoria, type ServicoSenha, type ServicoToken, type UserRepository } from './portas';

export interface LoginInput {
  email: string;
  senha: string;
}

export interface LoginResult {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: PublicUser;
}

interface Dependencias {
  users: UserRepository;
  senhas: ServicoSenha;
  tokens: ServicoToken;
  auditoria?: Auditoria;
}

/** Casos de uso de autenticação. Criptografia e JWT ficam atrás das portas. */
export class AuthService {
  private readonly auditoria: Auditoria;
  // Hash falso para gastar o mesmo tempo quando o e-mail não existe (evita enumeração por tempo).
  private readonly hashFalso: Promise<string>;

  constructor(private readonly deps: Dependencias) {
    this.auditoria = deps.auditoria ?? auditoriaNula;
    this.hashFalso = deps.senhas.hash('senha-inexistente');
  }

  async login({ email, senha }: LoginInput): Promise<LoginResult> {
    const user = await this.deps.users.findByEmail(email);
    const ok = await this.deps.senhas.verificar(senha, user ? user.senhaHash : await this.hashFalso);

    // Mesma mensagem para e-mail inexistente, senha errada ou usuário inativo.
    if (!user || !ok || !user.ativo) {
      this.auditoria.registrar('auth.login_falha', { usuario_id: user?.id ?? null });
      throw naoAutenticado('E-mail ou senha inválidos');
    }

    this.auditoria.registrar('auth.login_sucesso', { usuario_id: user.id, perfil: user.role });
    return {
      accessToken: this.deps.tokens.emitir({ sub: user.id, role: user.role }),
      tokenType: 'Bearer',
      expiresIn: this.deps.tokens.validadeSegundos,
      user: toPublicUser(user),
    };
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.deps.users.findById(userId);
    if (!user || !user.ativo) throw naoAutenticado();
    return toPublicUser(user);
  }
}
