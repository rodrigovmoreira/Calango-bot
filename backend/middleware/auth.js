import jwt from 'jsonwebtoken';

const authenticateToken = (req, res, next) => {
  // Tenta pegar o token do Cookie OU do Header Authorization
  const token = req.cookies.auth_token || req.headers['authorization']?.split(' ')[1];
  
  if (!token) return res.status(401).json({ message: 'Token necessário' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Token inválido' });
    req.user = user; // Salva o usuário na requisição (req.user.userId)
    next();
  });
};

export default authenticateToken;