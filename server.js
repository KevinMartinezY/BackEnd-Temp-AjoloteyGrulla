const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const crypto = require('crypto');
const bcrypt = require('bcrypt'); // Para encriptar contraseñas

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
    res.json({ mensaje: "¡El backend de Ajolote y Grulla está activo! 🚀" });
});

// ==========================================
// 1. RUTA PARA REGISTRAR USUARIOS NUEVOS
// ==========================================
app.post('/api/registro', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ ok: false, mensaje: "Faltan datos (correo o contraseña)." });
    }

    try {
        // Encriptamos la contraseña antes de guardarla en PostgreSQL
        const saltRounds = 10;
        const passwordEncriptada = await bcrypt.hash(password, saltRounds);

        await pool.query(
            'INSERT INTO usuarios (email, password) VALUES ($1, $2)',
            [email, passwordEncriptada]
        );

        console.log(`👤 Nuevo usuario registrado: ${email}`);
        res.status(201).json({ ok: true, mensaje: "Usuario registrado con éxito." });

    } catch (error) {
        if (error.code === '23505') { // Código de PostgreSQL para "correo duplicado"
            return res.status(400).json({ ok: false, mensaje: "Ese correo ya está registrado." });
        }
        console.error("Error al registrar:", error);
        res.status(500).json({ ok: false, mensaje: "Error interno al registrar usuario." });
    }
});

// ==========================================
// 2. RUTA PARA RECUPERAR CONTRASEÑA
// ==========================================
app.post('/api/recuperar', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ ok: false, mensaje: "El correo es obligatorio." });
    }

    try {
        const resultado = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);

        if (resultado.rows.length === 0) {
            return res.status(404).json({ ok: false, mensaje: "No encontramos una cuenta registrada con ese correo." });
        }

        const token = crypto.randomBytes(32).toString('hex');
        const expiracion = new Date(Date.now() + 3600000); // 1 hora

        await pool.query(
            'UPDATE usuarios SET reset_token = $1, token_expiracion = $2 WHERE email = $3',
            [token, expiracion, email]
        );

        console.log(`Token generado para ${email}: ${token}`);

        res.json({ 
            ok: true, 
            mensaje: "Se han enviado las instrucciones de recuperación a tu correo.",
            tokenDePrueba: token 
        });

    } catch (error) {
        console.error("Error en el servidor al procesar recuperación:", error);
        res.status(500).json({ ok: false, mensaje: "Error interno en el servidor." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});