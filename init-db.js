const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function initDatabase() {
    try {
        // Create users table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                username VARCHAR(255) PRIMARY KEY,
                displayname VARCHAR(255) NOT NULL,
                password VARCHAR(255) NOT NULL,
                status VARCHAR(50) DEFAULT 'offline',
                joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                bio TEXT,
                avatar_image TEXT,
                banner_image TEXT
            );
        `);

        // Create servers table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS servers (
                id VARCHAR(255) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                creator VARCHAR(255) NOT NULL,
                logo TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (creator) REFERENCES users(username) ON DELETE CASCADE
            );
        `);

        // Create rooms table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS rooms (
                id VARCHAR(255) PRIMARY KEY,
                server_id VARCHAR(255) NOT NULL,
                name VARCHAR(255) NOT NULL,
                creator VARCHAR(255) NOT NULL,
                type VARCHAR(50) DEFAULT 'text',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
                FOREIGN KEY (creator) REFERENCES users(username) ON DELETE CASCADE
            );
        `);

        // Create messages table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                room_id VARCHAR(255) NOT NULL,
                username VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
                FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE
            );
        `);

        // Create friends table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS friends (
                username VARCHAR(255) NOT NULL,
                friend_username VARCHAR(255) NOT NULL,
                PRIMARY KEY (username, friend_username),
                FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE,
                FOREIGN KEY (friend_username) REFERENCES users(username) ON DELETE CASCADE
            );
        `);

        // Create friend_requests table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS friend_requests (
                from_username VARCHAR(255) NOT NULL,
                to_username VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (from_username, to_username),
                FOREIGN KEY (from_username) REFERENCES users(username) ON DELETE CASCADE,
                FOREIGN KEY (to_username) REFERENCES users(username) ON DELETE CASCADE
            );
        `);

        // Create private_messages table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS private_messages (
                id SERIAL PRIMARY KEY,
                from_username VARCHAR(255) NOT NULL,
                to_username VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (from_username) REFERENCES users(username) ON DELETE CASCADE,
                FOREIGN KEY (to_username) REFERENCES users(username) ON DELETE CASCADE
            );
        `);

        // Create server_roles table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS server_roles (
                id VARCHAR(255) PRIMARY KEY,
                server_id VARCHAR(255) NOT NULL,
                name VARCHAR(255) NOT NULL,
                color VARCHAR(50) DEFAULT '#5865f2',
                permissions TEXT[],
                FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
            );
        `);

        // Create server_permissions table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS server_permissions (
                server_id VARCHAR(255) PRIMARY KEY,
                permissions JSON,
                FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
            );
        `);

        // Create server_invites table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS server_invites (
                server_id VARCHAR(255) NOT NULL,
                username VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (server_id, username),
                FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
                FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE
            );
        `);

        // Create server_members table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS server_members (
                server_id VARCHAR(255) NOT NULL,
                username VARCHAR(255) NOT NULL,
                joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (server_id, username),
                FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
                FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE
            );
        `);

        // Create room_members table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS room_members (
                room_id VARCHAR(255) NOT NULL,
                username VARCHAR(255) NOT NULL,
                PRIMARY KEY (room_id, username),
                FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
                FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE
            );
        `);

        console.log('Database schema created successfully');
        process.exit(0);
    } catch (error) {
        console.error('Error creating database schema:', error);
        process.exit(1);
    }
}

initDatabase();
