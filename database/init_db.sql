-- ========================================
-- Script d'initialisation de la base de données
-- Projet : NordStrat Website
-- Date : 2024-12-06
-- ========================================

-- Supprimer les tables existantes (si besoin de réinitialiser)
DROP TABLE IF EXISTS booking_archive CASCADE;
DROP TABLE IF EXISTS rate_limit_counter CASCADE;
DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS contact_message CASCADE;
DROP TABLE IF EXISTS news_post CASCADE;
DROP TABLE IF EXISTS public_event_application CASCADE;
DROP TABLE IF EXISTS public_event CASCADE;
DROP TABLE IF EXISTS event_attendance CASCADE;
DROP TABLE IF EXISTS reservation CASCADE;
DROP TABLE IF EXISTS game_table CASCADE;
DROP TABLE IF EXISTS event_table_closure CASCADE;
DROP TABLE IF EXISTS player_game CASCADE;
DROP TABLE IF EXISTS membership CASCADE;
DROP TABLE IF EXISTS game CASCADE;
DROP TABLE IF EXISTS event CASCADE;
DROP TABLE IF EXISTS player CASCADE;
DROP TABLE IF EXISTS role CASCADE;

-- Compteurs persistants et anonymisés pour la limitation de débit
CREATE TABLE rate_limit_counter (
    key_hash CHAR(64) PRIMARY KEY,
    hits INTEGER NOT NULL DEFAULT 1 CHECK (hits >= 0),
    reset_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_rate_limit_counter_reset_at ON rate_limit_counter(reset_at);

-- ========================================
-- TABLE : ROLE
-- Description : Rôles des utilisateurs (Admin, User)
-- ========================================
CREATE TABLE role (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Insertion des rôles par défaut
INSERT INTO role (name) VALUES 
    ('Admin'),
    ('User');

-- ========================================
-- TABLE : PLAYER
-- Description : Utilisateurs/Joueurs de l'association
-- ========================================
CREATE TABLE player (
    id SERIAL PRIMARY KEY,
    firstname VARCHAR(100) NOT NULL,
    lastname VARCHAR(100) NOT NULL,
    nickname VARCHAR(50),
    avatar_url TEXT,
    biography TEXT,
    is_profile_public BOOLEAN NOT NULL DEFAULT true,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role_id INTEGER NOT NULL REFERENCES role(id) ON DELETE RESTRICT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    moderation_status VARCHAR(30) NOT NULL DEFAULT 'active',
    suspended_until TIMESTAMPTZ,
    moderation_reason TEXT,
    moderated_at TIMESTAMPTZ,
    moderated_by INTEGER REFERENCES player(id) ON DELETE SET NULL,
    membership_expires_at TIMESTAMP,
    accepted_terms_at TIMESTAMPTZ,
    accepted_terms_version VARCHAR(20),
    anonymized_at TIMESTAMPTZ,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Contraintes
    CONSTRAINT check_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$'),
    CONSTRAINT check_player_biography_length CHECK (CHAR_LENGTH(biography) <= 500),
    CONSTRAINT check_player_moderation_status CHECK (
        moderation_status IN ('active', 'temporarily_suspended', 'permanently_suspended', 'deleted')
    ),
    CONSTRAINT check_player_anonymization CHECK (
        (moderation_status = 'deleted' AND is_active = false AND anonymized_at IS NOT NULL)
        OR
        (moderation_status <> 'deleted' AND anonymized_at IS NULL)
    ),
    CONSTRAINT check_player_moderation_reason_length CHECK (
        moderation_reason IS NULL OR CHAR_LENGTH(moderation_reason) BETWEEN 5 AND 500
    )
);

-- Index pour optimiser les recherches
CREATE INDEX idx_player_email ON player(email);
CREATE INDEX idx_player_role_id ON player(role_id);
CREATE INDEX idx_player_is_active ON player(is_active);
CREATE INDEX idx_player_moderation_status ON player(moderation_status);
CREATE INDEX idx_player_moderated_by ON player(moderated_by);
CREATE UNIQUE INDEX unique_player_email_lower ON player(LOWER(email));

-- ========================================
-- TABLE : AUDIT_LOG
-- Description : Journal immuable des actions administratives
-- ========================================
CREATE TABLE audit_log (
    id BIGSERIAL PRIMARY KEY,
    admin_id INTEGER REFERENCES player(id) ON DELETE SET NULL,
    admin_nickname VARCHAR(100) NOT NULL,
    category VARCHAR(30) NOT NULL,
    action VARCHAR(60) NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    target_id VARCHAR(100),
    target_label VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_audit_log_category CHECK (
        category IN ('game_tables', 'members', 'memberships', 'news', 'public_events')
    ),
    CONSTRAINT check_audit_log_description_length CHECK (
        CHAR_LENGTH(description) BETWEEN 1 AND 1000
    )
);

CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX idx_audit_log_category_created_at ON audit_log(category, created_at DESC);
CREATE INDEX idx_audit_log_admin_id ON audit_log(admin_id);

CREATE OR REPLACE FUNCTION prevent_audit_log_deletion()
RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Les entrées du journal d''audit ne peuvent être ni modifiées ni supprimées.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_prevent_delete
BEFORE UPDATE OR DELETE OR TRUNCATE ON audit_log
FOR EACH STATEMENT
EXECUTE FUNCTION prevent_audit_log_deletion();

-- ========================================
-- TABLE : NEWS_POST
-- Description : Actualités publiées par les administrateurs
-- ========================================
CREATE TABLE news_post (
    id SERIAL PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    content TEXT NOT NULL,
    image_url TEXT,
    author_id INTEGER NOT NULL REFERENCES player(id) ON DELETE RESTRICT,
    published_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT check_news_post_title_length CHECK (CHAR_LENGTH(title) BETWEEN 3 AND 150),
    CONSTRAINT check_news_post_content_length CHECK (CHAR_LENGTH(content) BETWEEN 20 AND 10000)
);

CREATE INDEX idx_news_post_published_at ON news_post(published_at DESC);
CREATE INDEX idx_news_post_author ON news_post(author_id);

-- ========================================
-- TABLES : PUBLIC_EVENT / PUBLIC_EVENT_APPLICATION
-- Description : Événements publics et demandes partenaires/bénévoles
-- ========================================
CREATE TABLE public_event (
    id SERIAL PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    event_date DATE NOT NULL,
    event_end_date DATE NOT NULL,
    registration_open_at DATE NOT NULL,
    registration_close_at DATE NOT NULL,
    description TEXT NOT NULL,
    is_visible BOOLEAN NOT NULL DEFAULT false,
    applications_enabled BOOLEAN NOT NULL DEFAULT false,
    created_by INTEGER NOT NULL REFERENCES player(id) ON DELETE RESTRICT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_public_event_dates CHECK (
        event_date <= event_end_date
        AND registration_open_at <= registration_close_at
        AND registration_close_at < event_date
    )
);

CREATE INDEX idx_public_event_visibility_date ON public_event(is_visible, event_date);

CREATE TABLE public_event_application (
    id SERIAL PRIMARY KEY,
    public_event_id INTEGER NOT NULL REFERENCES public_event(id) ON DELETE CASCADE,
    player_id INTEGER REFERENCES player(id) ON DELETE SET NULL,
    application_type VARCHAR(20) NOT NULL,
    contact_name VARCHAR(120) NOT NULL,
    organization_name VARCHAR(150),
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(30),
    participant_count INTEGER NOT NULL DEFAULT 1,
    present_saturday BOOLEAN NOT NULL DEFAULT false,
    present_sunday BOOLEAN NOT NULL DEFAULT false,
    table_count INTEGER NOT NULL DEFAULT 0,
    chair_count INTEGER NOT NULL DEFAULT 0,
    needs_electricity BOOLEAN NOT NULL DEFAULT false,
    power_outlet_count INTEGER NOT NULL DEFAULT 0,
    needs_water BOOLEAN NOT NULL DEFAULT false,
    space_length INTEGER,
    space_details TEXT,
    website_url TEXT,
    social_url_1 TEXT,
    social_url_2 TEXT,
    volunteer_tasks JSONB NOT NULL DEFAULT '[]'::jsonb,
    description TEXT NOT NULL,
    availability TEXT,
    needs TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'new',
    reviewed_by INTEGER REFERENCES player(id) ON DELETE RESTRICT,
    reviewed_at TIMESTAMPTZ,
    admin_notes TEXT,
    withdrawal_reason TEXT,
    withdrawn_at TIMESTAMPTZ,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_public_application_type CHECK (application_type IN ('partner', 'vendor', 'volunteer')),
    CONSTRAINT check_public_application_status CHECK (status IN ('new', 'reviewing', 'accepted', 'waitlisted', 'rejected', 'withdrawn')),
    CONSTRAINT check_public_application_details CHECK (
        (application_type IN ('partner', 'vendor') AND organization_name IS NOT NULL)
        OR application_type = 'volunteer'
    ),
    CONSTRAINT check_public_application_days CHECK (present_saturday OR present_sunday),
    CONSTRAINT check_public_application_participant_count CHECK (participant_count BETWEEN 1 AND 100),
    CONSTRAINT check_public_application_equipment CHECK (
        table_count BETWEEN 0 AND 6
        AND chair_count BETWEEN 0 AND 500
        AND power_outlet_count BETWEEN 0 AND 50
        AND (space_length IS NULL OR space_length BETWEEN 2 AND 6)
        AND jsonb_typeof(volunteer_tasks) = 'array'
    ),
    CONSTRAINT check_public_application_review CHECK (
        (status = 'new' AND reviewed_by IS NULL AND reviewed_at IS NULL)
        OR
        (status NOT IN ('new', 'withdrawn') AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
        OR
        status = 'withdrawn'
    ),
    CONSTRAINT check_public_application_withdrawal CHECK (
        (status = 'withdrawn' AND withdrawn_at IS NOT NULL)
        OR
        (status <> 'withdrawn' AND withdrawn_at IS NULL AND withdrawal_reason IS NULL)
    )
);

CREATE INDEX idx_public_application_event_type_status
    ON public_event_application(public_event_id, application_type, status);
CREATE INDEX idx_public_application_email ON public_event_application(email);
CREATE INDEX idx_public_application_player ON public_event_application(player_id);
CREATE UNIQUE INDEX unique_public_application_player_type
    ON public_event_application(public_event_id, player_id, application_type)
    WHERE player_id IS NOT NULL;

-- ========================================
-- TABLE : CONTACT_MESSAGE
-- Description : Messages envoyés depuis le formulaire de contact
-- ========================================
CREATE TABLE contact_message (
    id SERIAL PRIMARY KEY,
    player_id INTEGER REFERENCES player(id) ON DELETE SET NULL,
    author_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(30),
    subject VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'unread',
    read_at TIMESTAMPTZ,
    read_by INTEGER REFERENCES player(id) ON DELETE RESTRICT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT check_contact_message_status CHECK (status IN ('unread', 'read', 'archived')),
    CONSTRAINT check_contact_author_length CHECK (CHAR_LENGTH(author_name) BETWEEN 2 AND 100),
    CONSTRAINT check_contact_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$'),
    CONSTRAINT check_contact_phone_length CHECK (phone IS NULL OR CHAR_LENGTH(phone) BETWEEN 6 AND 30),
    CONSTRAINT check_contact_subject_length CHECK (CHAR_LENGTH(subject) BETWEEN 3 AND 150),
    CONSTRAINT check_contact_message_length CHECK (CHAR_LENGTH(message) BETWEEN 20 AND 5000),
    CONSTRAINT check_contact_reading_state CHECK (
        (status = 'unread' AND read_at IS NULL AND read_by IS NULL)
        OR
        (status IN ('read', 'archived') AND read_at IS NOT NULL AND read_by IS NOT NULL)
    )
);

CREATE INDEX idx_contact_message_status_created ON contact_message(status, created_at);
CREATE INDEX idx_contact_message_player ON contact_message(player_id);
CREATE INDEX idx_contact_message_reader ON contact_message(read_by);

-- ========================================
-- TABLE : MEMBERSHIP
-- Description : Suivi annuel des cotisations, du 1er septembre au 31 août
-- ========================================
CREATE TABLE membership (
    id SERIAL PRIMARY KEY,
    player_id INTEGER NOT NULL REFERENCES player(id) ON DELETE CASCADE,
    season_start DATE NOT NULL,
    season_end DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'unpaid',
    paid_at TIMESTAMPTZ,
    amount_cents INTEGER,
    payment_method VARCHAR(30),
    source VARCHAR(30) NOT NULL DEFAULT 'manual',
    external_reference VARCHAR(255) UNIQUE,
    recorded_by INTEGER NOT NULL REFERENCES player(id) ON DELETE RESTRICT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT unique_player_membership_season UNIQUE (player_id, season_start),
    CONSTRAINT check_membership_status CHECK (status IN ('unpaid', 'paid', 'exempted', 'cancelled')),
    CONSTRAINT check_membership_source CHECK (source IN ('manual', 'bank_transfer')),
    CONSTRAINT check_membership_payment_method CHECK (
        payment_method IS NULL OR payment_method IN ('cash', 'check', 'bank_transfer', 'card', 'other')
    ),
    CONSTRAINT check_membership_amount CHECK (amount_cents IS NULL OR amount_cents >= 0),
    CONSTRAINT check_membership_paid_at CHECK (
        (status = 'paid' AND paid_at IS NOT NULL) OR
        (status <> 'paid' AND paid_at IS NULL)
    ),
    CONSTRAINT check_membership_payment_details CHECK (
        (status = 'paid' AND payment_method IS NOT NULL)
        OR
        (status <> 'paid' AND payment_method IS NULL)
    ),
    CONSTRAINT check_membership_season CHECK (
        season_start = MAKE_DATE(EXTRACT(YEAR FROM season_start)::INTEGER, 9, 1)
        AND season_end = (season_start + INTERVAL '1 year' - INTERVAL '1 day')::DATE
    )
);

CREATE INDEX idx_membership_season_status ON membership(season_start, status);
CREATE INDEX idx_membership_recorded_by ON membership(recorded_by);

-- ========================================
-- TABLE : EVENT
-- Description : Événements organisés par l'association
-- ========================================
CREATE TABLE event (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    date TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'upcoming',
    max_table INTEGER NOT NULL DEFAULT 8,
    registration_deadline TIMESTAMPTZ NOT NULL,
    is_paid BOOLEAN NOT NULL DEFAULT false,
    price INTEGER NOT NULL DEFAULT 0,
    reservable BOOLEAN NOT NULL DEFAULT true,
    created_by INTEGER NOT NULL REFERENCES player(id) ON DELETE RESTRICT,
    cancellation_reason TEXT,
    cancelled_at TIMESTAMPTZ,
    cancelled_by INTEGER REFERENCES player(id) ON DELETE RESTRICT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Contraintes
    CONSTRAINT check_status CHECK (status IN ('upcoming', 'ongoing', 'completed', 'cancelled')),
    CONSTRAINT check_max_table CHECK (max_table > 0 AND max_table <= 8),
    CONSTRAINT check_price CHECK (price >= 0),
    CONSTRAINT check_deadline_before_event CHECK (registration_deadline <= date),
    CONSTRAINT check_event_cancellation CHECK (
        (status = 'cancelled' AND cancellation_reason IS NOT NULL AND cancelled_at IS NOT NULL AND cancelled_by IS NOT NULL)
        OR
        (status <> 'cancelled' AND cancellation_reason IS NULL AND cancelled_at IS NULL AND cancelled_by IS NULL)
    )
);

-- Index pour optimiser les recherches
CREATE INDEX idx_event_date ON event(date);
CREATE INDEX idx_event_status ON event(status);
CREATE INDEX idx_event_created_by ON event(created_by);
CREATE INDEX idx_event_cancelled_by ON event(cancelled_by);

CREATE TABLE event_table_closure (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES event(id) ON DELETE CASCADE,
    table_number INTEGER NOT NULL CHECK (table_number BETWEEN 1 AND 8),
    closed_by INTEGER NOT NULL REFERENCES player(id) ON DELETE RESTRICT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_event_table_closure UNIQUE (event_id, table_number)
);

CREATE INDEX idx_event_table_closure_closed_by ON event_table_closure(closed_by);

-- ========================================
-- TABLE : GAME
-- Description : Jeux disponibles dans l'association
-- ========================================
CREATE TABLE game (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    universe VARCHAR(100),
    description TEXT,
    min_players INTEGER,
    max_players INTEGER,
    image_url TEXT,
    is_available BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Contraintes
    CONSTRAINT check_players_range CHECK (
        (min_players IS NULL AND max_players IS NULL) OR
        (min_players > 0 AND max_players >= min_players)
    )
);

-- Index pour optimiser les recherches
CREATE INDEX idx_game_name ON game(name);
CREATE UNIQUE INDEX unique_game_name_lower ON game(LOWER(name));
CREATE INDEX idx_game_is_available ON game(is_available);
CREATE INDEX idx_game_universe ON game(universe);

-- ========================================
-- TABLE : PLAYER_GAME
-- Description : Jusqu'à trois jeux favoris affichés sur le profil public
-- ========================================
CREATE TABLE player_game (
    player_id INTEGER NOT NULL REFERENCES player(id) ON DELETE CASCADE,
    game_id INTEGER NOT NULL REFERENCES game(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (player_id, game_id),
    CONSTRAINT unique_player_game_position UNIQUE (player_id, position),
    CONSTRAINT check_player_game_position CHECK (position BETWEEN 1 AND 3)
);

CREATE INDEX idx_player_game_game_id ON player_game(game_id);

-- ========================================
-- TABLE : GAME_TABLE
-- Description : Tables de jeu disponibles lors d'un événement
-- ========================================
CREATE TABLE game_table (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES event(id) ON DELETE CASCADE,
    table_number INTEGER NOT NULL,
    game_id INTEGER NOT NULL REFERENCES game(id) ON DELETE RESTRICT,
    max_players INTEGER NOT NULL DEFAULT 10,
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    host_player_id INTEGER NOT NULL REFERENCES player(id) ON DELETE RESTRICT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Contraintes
    CONSTRAINT check_table_number CHECK (table_number BETWEEN 1 AND 8),
    CONSTRAINT check_table_max_players CHECK (max_players BETWEEN 1 AND 10),
    CONSTRAINT check_game_table_status CHECK (status IN ('open', 'closed', 'cancelled')),
    CONSTRAINT unique_table_per_event UNIQUE (event_id, table_number),
    -- Nécessaire pour garantir qu'une réservation référence la table
    -- et l'événement auxquels elle appartient réellement.
    CONSTRAINT unique_game_table_event UNIQUE (id, event_id)
);

-- Index pour optimiser les recherches
CREATE INDEX idx_game_table_event_id ON game_table(event_id);
CREATE INDEX idx_game_table_game_id ON game_table(game_id);
CREATE INDEX idx_game_table_status ON game_table(status);
CREATE INDEX idx_game_table_host_player_id ON game_table(host_player_id);

-- ========================================
-- TABLE : RESERVATION
-- Description : Réservations des joueurs sur les tables
-- ========================================
CREATE TABLE reservation (
    id SERIAL PRIMARY KEY,
    player_id INTEGER NOT NULL REFERENCES player(id) ON DELETE CASCADE,
    game_table_id INTEGER NOT NULL,
    event_id INTEGER NOT NULL REFERENCES event(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'confirmed',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cancelled_at TIMESTAMP,
    
    -- Contraintes
    CONSTRAINT check_reservation_status CHECK (status IN ('confirmed', 'cancelled')),
    CONSTRAINT fk_reservation_table_event
        FOREIGN KEY (game_table_id, event_id)
        REFERENCES game_table(id, event_id)
        ON DELETE CASCADE,
    CONSTRAINT check_cancelled_at CHECK (
        (status = 'cancelled' AND cancelled_at IS NOT NULL) OR
        (status != 'cancelled' AND cancelled_at IS NULL)
    )
);

-- Index pour optimiser les recherches
CREATE INDEX idx_reservation_player_id ON reservation(player_id);
CREATE INDEX idx_reservation_game_table_id ON reservation(game_table_id);
CREATE INDEX idx_reservation_event_id ON reservation(event_id);
CREATE INDEX idx_reservation_status ON reservation(status);

-- Un joueur ne peut occuper qu'une seule table par événement, mais une
-- réservation annulée ne l'empêche pas de se réinscrire plus tard.
CREATE UNIQUE INDEX unique_active_player_per_event
    ON reservation(player_id, event_id)
    WHERE status = 'confirmed';

-- Accélère le calcul du nombre de places occupées. Ce nombre est volontairement
-- calculé depuis les réservations et n'est pas dupliqué dans game_table.
CREATE INDEX idx_active_reservation_game_table
    ON reservation(game_table_id)
    WHERE status = 'confirmed';

-- ========================================
-- TABLE : EVENT_ATTENDANCE
-- Description : Exceptions au comptage automatique des joueurs inscrits.
-- Une réservation confirmée vaut présence, sauf désistement explicite.
-- ========================================
CREATE TABLE event_attendance (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES event(id) ON DELETE CASCADE,
    player_id INTEGER NOT NULL REFERENCES player(id) ON DELETE CASCADE,
    game_table_id INTEGER REFERENCES game_table(id) ON DELETE SET NULL,
    table_number INTEGER NOT NULL,
    game_id INTEGER REFERENCES game(id) ON DELETE SET NULL,
    game_name VARCHAR(255) NOT NULL,
    attended BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Contraintes
    CONSTRAINT check_attendance_table_number CHECK (table_number BETWEEN 1 AND 8),
    CONSTRAINT unique_attendance_player_event UNIQUE (event_id, player_id)
);

-- Index pour optimiser les statistiques
CREATE INDEX idx_event_attendance_event_id ON event_attendance(event_id);
CREATE INDEX idx_event_attendance_player_id ON event_attendance(player_id);
CREATE INDEX idx_event_attendance_game_id ON event_attendance(game_id);
CREATE INDEX idx_event_attendance_game_name ON event_attendance(game_name);
CREATE INDEX idx_event_attendance_attended ON event_attendance(attended);
CREATE INDEX idx_event_attendance_created_at ON event_attendance(created_at);

-- ========================================
-- TABLE : BOOKING_ARCHIVE
-- Description : Instantané JSON immuable d'une soirée clôturée. Il est créé
-- avant la suppression hebdomadaire des tables et réservations actives.
-- ========================================
CREATE TABLE booking_archive (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES event(id) ON DELETE RESTRICT,
    event_date TIMESTAMPTZ NOT NULL,
    schema_version INTEGER NOT NULL DEFAULT 1,
    snapshot JSONB NOT NULL,
    archived_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Une soirée ne doit être archivée qu'une fois. Cette contrainte rend la
    -- tâche de clôture hebdomadaire idempotente.
    CONSTRAINT unique_booking_archive_event UNIQUE (event_id),
    CONSTRAINT check_archive_schema_version CHECK (schema_version > 0),
    CONSTRAINT check_archive_snapshot_object CHECK (jsonb_typeof(snapshot) = 'object')
);

CREATE INDEX idx_booking_archive_event_date ON booking_archive(event_date);
CREATE INDEX idx_booking_archive_archived_at ON booking_archive(archived_at);
CREATE INDEX idx_booking_archive_snapshot ON booking_archive USING GIN(snapshot);
