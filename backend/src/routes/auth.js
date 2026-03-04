const router = require('express').Router();
const { body } = require('express-validator');
const { register, login, me, updateProfile, forgotPassword } = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth');

router.post('/register', [
  body('name').trim().notEmpty().withMessage('Nombre requerido'),
  body('email').isEmail().withMessage('Email inválido'),
  body('password').isLength({ min: 6 }).withMessage('Mínimo 6 caracteres'),
], register);

router.post('/login', [
  body('email').isEmail().withMessage('Email inválido'),
  body('password').notEmpty().withMessage('Contraseña requerida'),
], login);

router.get('/me', authenticate, me);

router.put('/profile', authenticate, [
  body('name').optional().trim().notEmpty().withMessage('El nombre no puede estar vacío'),
  body('email').optional().isEmail().withMessage('Email inválido'),
  body('newPassword').optional().isLength({ min: 6 }).withMessage('Mínimo 6 caracteres'),
], updateProfile);

router.post('/forgot-password', [
  body('email').isEmail().withMessage('Email inválido'),
], forgotPassword);

module.exports = router;
