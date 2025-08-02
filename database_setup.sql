-- ============================================
-- FindMe Emergency Response Platform
-- Database Setup Script
-- ============================================

-- Create database
CREATE DATABASE IF NOT EXISTS safety_db;
USE safety_db;

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8),
    role VARCHAR(50) DEFAULT 'user',
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================
-- SERVICES TABLE
-- ============================================
CREATE TABLE services (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    service_type ENUM('fire', 'police', 'hospital', 'medical') NOT NULL,
    phone VARCHAR(20),
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8),
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================
-- EMERGENCY ALERTS TABLE
-- ============================================
CREATE TABLE emergency_alerts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type VARCHAR(100) NOT NULL,
    details TEXT,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    resolved TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_resolved (resolved),
    INDEX idx_created_at (created_at),
    INDEX idx_location (latitude, longitude)
);

-- ============================================
-- EMERGENCY CHATS TABLE
-- ============================================
CREATE TABLE emergency_chats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    alert_id INT NOT NULL,
    room_id VARCHAR(255) UNIQUE NOT NULL,
    victim_id INT NOT NULL,
    closed TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP NULL,
    FOREIGN KEY (alert_id) REFERENCES emergency_alerts(id) ON DELETE CASCADE,
    FOREIGN KEY (victim_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_alert_id (alert_id),
    INDEX idx_room_id (room_id),
    INDEX idx_victim_id (victim_id),
    INDEX idx_closed (closed)
);

-- ============================================
-- EMERGENCY CHAT MESSAGES TABLE
-- ============================================
CREATE TABLE emergency_chat_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    room_id VARCHAR(255) NOT NULL,
    user_id INT,
    message TEXT NOT NULL,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES emergency_chats(room_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_room_id (room_id),
    INDEX idx_user_id (user_id),
    INDEX idx_sent_at (sent_at)
);

-- ============================================
-- EMERGENCY CHAT MEMBERS TABLE
-- ============================================
CREATE TABLE emergency_chat_members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    room_id VARCHAR(255) NOT NULL,
    user_id INT NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP NULL,
    FOREIGN KEY (room_id) REFERENCES emergency_chats(room_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_room_user (room_id, user_id),
    INDEX idx_room_id (room_id),
    INDEX idx_user_id (user_id)
);

-- ============================================
-- FRIENDS TABLE
-- ============================================
CREATE TABLE friends (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    friend_id INT NOT NULL,
    status ENUM('pending', 'accepted', 'declined') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_friendship (user_id, friend_id),
    INDEX idx_user_id (user_id),
    INDEX idx_friend_id (friend_id),
    INDEX idx_status (status)
);

-- ============================================
-- FRIEND MESSAGES TABLE
-- ============================================
CREATE TABLE friend_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sender_id INT NOT NULL,
    receiver_id INT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP NULL,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_sender_id (sender_id),
    INDEX idx_receiver_id (receiver_id),
    INDEX idx_created_at (created_at),
    INDEX idx_conversation (sender_id, receiver_id, created_at)
);

-- ============================================
-- BLOCKED USERS TABLE
-- ============================================
CREATE TABLE blocked_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    blocked_user_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (blocked_user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_block (user_id, blocked_user_id),
    INDEX idx_user_id (user_id),
    INDEX idx_blocked_user_id (blocked_user_id)
);

-- ============================================
-- REPORTS TABLE
-- ============================================
CREATE TABLE reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    text TEXT NOT NULL,
    status ENUM('pending', 'reviewed', 'resolved') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    reviewed_by INT NULL,
    review_notes TEXT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
);

-- ============================================
-- INSERT SAMPLE DATA (OPTIONAL)
-- ============================================

-- Sample Admin User
INSERT INTO users (name, email, password, role) VALUES 
('Admin User', 'admin@findme.com', 'hashed_password_here', 'admin');

-- Sample Fire Service
INSERT INTO services (company_name, email, password, service_type, phone, lat, lng) VALUES 
('Central Fire Department', 'fire@central.gov', 'hashed_password_here', 'fire', '+1-555-FIRE', 40.7128, -74.0060);

-- Sample Medical Service
INSERT INTO services (company_name, email, password, service_type, phone, lat, lng) VALUES 
('City General Hospital', 'emergency@citygeneral.com', 'hashed_password_here', 'medical', '+1-555-HELP', 40.7589, -73.9851);

-- ============================================
-- FOREIGN KEY CONSTRAINTS (Additional)
-- ============================================

-- Add unique constraint to emergency_chats room_id
ALTER TABLE emergency_chats ADD UNIQUE (room_id);

-- ============================================
-- PERFORMANCE OPTIMIZATIONS
-- ============================================

-- Composite indexes for common queries
CREATE INDEX idx_alerts_location_resolved ON emergency_alerts(latitude, longitude, resolved);
CREATE INDEX idx_friends_user_status ON friends(user_id, status);
CREATE INDEX idx_messages_conversation_time ON friend_messages(sender_id, receiver_id, created_at);
CREATE INDEX idx_chat_messages_room_time ON emergency_chat_messages(room_id, sent_at);

-- ============================================
-- VIEWS FOR COMMON QUERIES (OPTIONAL)
-- ============================================

-- Active emergency alerts view
CREATE VIEW active_emergency_alerts AS
SELECT 
    ea.*,
    u.name as user_name,
    u.email as user_email,
    u.phone as user_phone
FROM emergency_alerts ea
JOIN users u ON ea.user_id = u.id
WHERE ea.resolved = 0;

-- Friends list view
CREATE VIEW user_friends AS
SELECT 
    f.user_id,
    f.friend_id,
    u.name as friend_name,
    u.email as friend_email,
    u.status as friend_status,
    f.created_at as friendship_date
FROM friends f
JOIN users u ON f.friend_id = u.id
WHERE f.status = 'accepted';

-- ============================================
-- STORED PROCEDURES (OPTIONAL)
-- ============================================

DELIMITER //

-- Procedure to get nearby users for emergency alerts
CREATE PROCEDURE GetNearbyUsers(
    IN alert_lat DECIMAL(10,8),
    IN alert_lng DECIMAL(11,8),
    IN radius_km DECIMAL(5,2),
    IN exclude_user_id INT
)
BEGIN
    SELECT 
        id,
        name,
        email,
        lat,
        lng,
        (
            6371 * acos(
                cos(radians(alert_lat)) * 
                cos(radians(lat)) * 
                cos(radians(lng) - radians(alert_lng)) + 
                sin(radians(alert_lat)) * 
                sin(radians(lat))
            )
        ) AS distance_km
    FROM users 
    WHERE 
        id != exclude_user_id 
        AND lat IS NOT NULL 
        AND lng IS NOT NULL
        AND status = 'active'
    HAVING distance_km <= radius_km
    ORDER BY distance_km;
END //

DELIMITER ;

-- ============================================
-- TRIGGERS FOR DATA CONSISTENCY
-- ============================================

-- Update resolved_at timestamp when alert is resolved
DELIMITER //
CREATE TRIGGER update_alert_resolved_time
    BEFORE UPDATE ON emergency_alerts
    FOR EACH ROW
BEGIN
    IF NEW.resolved = 1 AND OLD.resolved = 0 THEN
        SET NEW.resolved_at = CURRENT_TIMESTAMP;
    END IF;
END //
DELIMITER ;

-- Automatically close emergency chat when alert is resolved
DELIMITER //
CREATE TRIGGER close_chat_on_alert_resolved
    AFTER UPDATE ON emergency_alerts
    FOR EACH ROW
BEGIN
    IF NEW.resolved = 1 AND OLD.resolved = 0 THEN
        UPDATE emergency_chats 
        SET closed = 1, closed_at = CURRENT_TIMESTAMP 
        WHERE alert_id = NEW.id;
    END IF;
END //
DELIMITER ;

-- ============================================
-- GRANT PERMISSIONS (ADJUST AS NEEDED)
-- ============================================

-- Create application user (recommended for production)
-- CREATE USER 'findme_app'@'localhost' IDENTIFIED BY 'secure_password_here';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON safety_db.* TO 'findme_app'@'localhost';
-- FLUSH PRIVILEGES;

-- ============================================
-- DATABASE SETUP COMPLETE
-- ============================================

SELECT 'Database setup completed successfully!' as status;
SELECT COUNT(*) as total_tables FROM information_schema.tables WHERE table_schema = 'safety_db';