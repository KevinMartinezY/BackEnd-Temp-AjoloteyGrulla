const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();

// Middlewares
app.use(express.json());
app.use(cors());

// Conexión única a PostgreSQL (usa Internal Database URL en Render)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

// Crea la tabla de usuarios automáticamente al arrancar
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
        console.log(" Base de datos conectada y tabla 'usuarios' lista");
    } catch (error) {
        console.error(" Error al conectar a PostgreSQL:", error);
    }
};

iniciarBaseDeDatos();

// Ruta principal de prueba
app.get('/', (req, res) => {
    res.json({ mensaje: "¡El backend de Ajolote y Grulla está activo!" });
});

// Ruta para el formulario de recuperar contraseña
app.post('/api/recuperar', (req, res) => {
    const { email } = req.body;
    console.log("Petición de recuperación recibida para:", email);
    res.json({ ok: true, mensaje: "Si el correo existe, se enviarán las instrucciones." });
});

// Puerto asignado por Render o 3000 por defecto
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});