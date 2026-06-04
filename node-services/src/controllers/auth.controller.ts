import { type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js'; // <-- Importamos la conexión centralizada

const JWT_SECRET = process.env.JWT_SECRET || 'secreto_fallback';

export const register = async (req: Request, res: Response): Promise<void> => {
// ... el resto de tu código queda idéntico hacia abajo
  try {
    const { name, email, password } = req.body;

    // 1. Validar si el usuario ya existe
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(400).json({ error: 'El correo ya está registrado' });
      return;
    }

    // 2. Encriptar la contraseña (¡Nunca guardar en texto plano!)
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // 3. Crear el usuario en PostgreSQL
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password_hash,
      },
    });

    // 4. Generar el JWT
    const token = jwt.sign({ userId: newUser.id }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      message: 'Usuario creado exitosamente',
      token,
      user: { id: newUser.id, name: newUser.name, email: newUser.email }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error interno del servidor al registrar' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // 1. Buscar al usuario
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ error: 'Credenciales inválidas' });
      return;
    }

    // 2. Comparar contraseñas
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      res.status(401).json({ error: 'Credenciales inválidas' });
      return;
    }

    // 3. Generar el JWT
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    res.status(200).json({
      message: 'Login exitoso',
      token,
      user: { id: user.id, name: user.name, email: user.email }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error interno del servidor al iniciar sesión' });
  }
};