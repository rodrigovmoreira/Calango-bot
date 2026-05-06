import jwt from 'jsonwebtoken';
import SystemUser from '../models/SystemUser.js';

export const authenticateToken = (req, res, next) => {
  // Tenta pegar o token do Cookie OU do Header Authorization
  const token = req.cookies.auth_token || req.headers['authorization']?.split(' ')[1];
  
  if (!token) return res.status(401).json({ message: 'Token necessário' });

  jwt.verify(token, process.env.JWT_SECRET, async (err, decodedUser) => {
    if (err) return res.status(403).json({ message: 'Token inválido' });

    try {
      const user = await SystemUser.findById(decodedUser.userId).select('activeBusinessId businesses');
      if (!user) return res.status(401).json({ message: 'Usuário não encontrado' });

      req.user = {
        userId: decodedUser.userId,
        activeBusinessId: user.activeBusinessId
      };

      next();
    } catch (error) {
      console.error('Erro ao verificar usuário no token:', error);
      res.status(500).json({ message: 'Erro interno' });
    }
  });
};

export const requireAdmin = async (req, res, next) => {
  try {
    const user = await SystemUser.findById(req.user.userId).select('businesses activeBusinessId');
    if (!user) return res.status(401).json({ message: 'Usuário não encontrado' });

    if (!user.activeBusinessId) return res.status(403).json({ message: 'Nenhum negócio ativo' });

    const business = user.businesses.find(b => b.businessId.toString() === user.activeBusinessId.toString());
    if (!business || business.role !== 'admin') {
      return res.status(403).json({ message: 'Acesso negado: Requer permissão de administrador' });
    }

    next();
  } catch (error) {
    console.error('Erro no requireAdmin:', error);
    res.status(500).json({ message: 'Erro ao verificar permissões' });
  }
};

export default authenticateToken;