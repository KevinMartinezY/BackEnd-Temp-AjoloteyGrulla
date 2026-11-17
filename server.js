const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const app = express();

app.use(express.json());
app.use(cors());

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
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
    res.json({ mensaje: "El backend de Ajolote y Grulla está activo" });
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
        console.log("Ta bien");
        res.status(201).json({ ok: true, mensaje: "Usuario registrado con éxito." });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ ok: false, mensaje: "Ese correo ya está registrado." });
        }
        console.error("Error al registrar:", error);
        res.status(500).json({ ok: false, mensaje: "Error interno al registrar." });
    }
});

// 2. RECUPERAR (Genera token y envía el correo con Resend)
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

        const linkRecuperacion = `https://ajolote-backend.onrender.com/api/cambiar-password?token=${token}`;

        // Enviar el correo usando la API HTTP de Resend
        await resend.emails.send({
            from: 'Ajolote y Grulla <onboarding@resend.dev>',
            to: email,
            subject: 'Recuperación de contraseña - Ajolote y Grulla',
            html: `
                <div style="font-family: Arial, sans-serif; color: #333;">
                    <h2>Recuperación de Contraseña</h2>
                    <p>Has solicitado restablecer tu contraseña.</p>
                    <a href="${linkRecuperacion}" style="background-color: #ff6b6b; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Restablecer Contraseña</a>
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
        const resultado = await pool.query(
            'SELECT * FROM usuarios WHERE reset_token = $1 AND token_expiracion > NOW()',
            [token]
        );

        if (resultado.rows.length === 0) {
            return res.status(400).json({ ok: false, mensaje: "El token es inválido o ya expiró." });
        }

        const usuario = resultado.rows[0];

        const saltRounds = 10;
        const passwordEncriptada = await bcrypt.hash(nuevaPassword, saltRounds);

        await pool.query(
            'UPDATE usuarios SET password = $1, reset_token = NULL, token_expiracion = NULL WHERE id = $2',
            [passwordEncriptada, usuario.id]
        );

        console.log(`Contraseña actualizada con éxito para el usuario ID: ${usuario.id}`);
        res.json({ ok: true, mensaje: "Contraseña actualizada con éxito!" });

    } catch (error) {
        console.error("Error al cambiar contraseña:", error);
        res.status(500).json({ ok: false, mensaje: "Error interno del servidor." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});