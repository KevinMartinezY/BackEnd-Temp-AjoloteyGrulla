const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer'); // Para enviar correos

const app = express();

app.use(express.json());
app.use(cors());

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

// Configuración de Nodemailer usando tu Gmail
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const iniciarBaseDeDatos = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS usuarios (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                reset_token VARCHAR(255),
                token_expiracion TIMESTAMP
            );
        `);
        console.log("Base de datos conectada y tabla 'usuarios' lista");
    } catch (error) {
        console.error("Error al conectar a PostgreSQL:", error);
    }
};

iniciarBaseDeDatos();

app.get('/', (req, res) => {
    res.json({ mensaje: "¡El backend de Ajolote y Grulla está activo! 🚀" });
});

// 1. REGISTRO
app.post('/api/registro', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ ok: false, mensaje: "Faltan datos." });
    }

    try {
        const saltRounds = 10;
        const passwordEncriptada = await bcrypt.hash(password, saltRounds);

        await pool.query(
            'INSERT INTO usuarios (email, password) VALUES ($1, $2)',
            [email, passwordEncriptada]
        );

        console.log(`Nuevo usuario registrado: ${email}`);
        res.status(201).json({ ok: true, mensaje: "Usuario registrado con éxito." });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ ok: false, mensaje: "Ese correo ya está registrado." });
        }
        console.error("Error al registrar:", error);
        res.status(500).json({ ok: false, mensaje: "Error interno al registrar." });
    }
});

// 2. RECUPERAR (Genera token y envía el correo real)
app.post('/api/recuperar', async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ ok: false, mensaje: "El correo es obligatorio." });
    }

    try {
        const resultado = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);

        if (resultado.rows.length === 0) {
            return res.status(404).json({ ok: false, mensaje: "No encontramos una cuenta con ese correo." });
        }

        const token = crypto.randomBytes(32).toString('hex');
        const expiracion = new Date(Date.now() + 3600000); // 1 hora de vigencia

        await pool.query(
            'UPDATE usuarios SET reset_token = $1, token_expiracion = $2 WHERE email = $3',
            [token, expiracion, email]
        );

        // Enlace que le llegará al usuario (apuntando a tu frontend o vista de cambio de password)
        const linkRecuperacion = `https://ajolote-backend.onrender.com/api/recuperar?token=${token}`;

        // Enviar el correo usando Nodemailer
        await transporter.sendMail({
            from: `"Ajolote y Grulla" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Recuperación de contraseña - Ajolote y Grulla',
            html: `
                <div style="font-family: Arial, sans-serif; color: #333;">
                    <h2>Recuperación de Contraseña 🐾</h2>
                    <p>Has solicitado restablecer tu contraseña en Ajolote y Grulla.</p>
                    <p>Haz clic en el siguiente botón para continuar (el enlace expira en 1 hora):</p>
                    <a href="${linkRecuperacion}" style="background-color: #ff6b6b; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Restablecer Contraseña</a>
                    <p>Si tú no pediste esto, puedes ignorar este correo.</p>
                </div>
            `
        });

        console.log(`Correo de recuperación enviado a: ${email}`);
        res.json({ ok: true, mensaje: "Se han enviado las instrucciones a tu correo." });

    } catch (error) {
        console.error("Error al enviar correo:", error);
        res.status(500).json({ ok: false, mensaje: "Error al enviar el correo de recuperación." });
    }
});

// 3. CAMBIAR CONTRASEÑA (Recibe el token y la nueva contraseña)
app.post('/api/cambiar-password', async (req, res) => {
    const { token, nuevaPassword } = req.body;

    if (!token || !nuevaPassword) {
        return res.status(400).json({ ok: false, mensaje: "Datos incompletos." });
    }

    try {
        // Buscar si el token existe y si aún no expira
        const resultado = await pool.query(
            'SELECT * FROM usuarios WHERE reset_token = $1 AND token_expiracion > NOW()',
            [token]
        );

        if (resultado.rows.length === 0) {
            return res.status(400).json({ ok: false, mensaje: "El token es inválido o ya expiró." });
        }

        const usuario = resultado.rows[0];

        // Encriptar la nueva contraseña
        const saltRounds = 10;
        const passwordEncriptada = await bcrypt.hash(nuevaPassword, saltRounds);

        // Actualizar contraseña y borrar el token usado
        await pool.query(
            'UPDATE usuarios SET password = $1, reset_token = NULL, token_expiracion = NULL WHERE id = $2',
            [passwordEncriptada, usuario.id]
        );

        console.log(`Contraseña actualizada con éxito para el usuario ID: ${usuario.id}`);
        res.json({ ok: true, mensaje: "¡Contraseña actualizada con éxito!" });

    } catch (error) {
        console.error("Error al cambiar contraseña:", error);
        res.status(500).json({ ok: false, mensaje: "Error interno del servidor." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});