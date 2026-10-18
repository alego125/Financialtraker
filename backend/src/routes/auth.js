const router = require('express').Router();
const { body } = require('express-validator');
const { register, login, me, updateProfile, forgotPassword, logout } = require('../controllers/auth.controller');
const { rateLimit } = require('../middlewares/security');
const attempts = rateLimit({ max: 20, windowMs: 15 * 60 * 1000 });
const { authenticate } = require('../middlewares/auth');

router.post('/register', attempts, [
  body('name').trim().notEmpty().withMessage('Nombre requerido'),
  body('email').trim().toLowerCase().isEmail().withMessage('Email inválido'),
  body('password').isLength({ min: 10 }).custom(v => Buffer.byteLength(v, 'utf8') <= 72).withMessage('Mínimo 10 caracteres y máximo 72 bytes'),
], register);

router.post('/login', attempts, [
  body('email').trim().toLowerCase().isEmail().withMessage('Email inválido'),
  body('password').notEmpty().withMessage('Contraseña requerida'),
], login);

router.post('/logout', authenticate, logout);
router.get('/me', authenticate, me);

router.put('/profile', authenticate, [
  body('name').optional().trim().notEmpty().withMessage('El nombre no puede estar vacío'),
  body('email').trim().toLowerCase().optional().isEmail().withMessage('Email inválido'),
  body('newPassword').optional().isLength({ min: 10 }).custom(v => Buffer.byteLength(v, 'utf8') <= 72).withMessage('Mínimo 10 caracteres y máximo 72 bytes'),
], updateProfile);

router.post('/forgot-password', [
  body('email').trim().toLowerCase().isEmail().withMessage('Email inválido'),
], forgotPassword);

module.exports = router;
