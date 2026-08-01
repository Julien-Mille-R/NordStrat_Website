ROLE (#id, name, created_at, updated_at)

PLAYER (#id, firstname, lastname, nickname, avatar_url, biography,
        is_profile_public, email, password,
        is_active, moderation_status, suspended_until, moderation_reason,
        moderated_at, membership_expires_at, accepted_terms_at,
        accepted_terms_version, created_at, updated_at,
        #role_id->ROLE, #moderated_by->PLAYER)
        
EVENT (#id, title, date, status, max_table, registration_deadline,
       is_paid, price, reservable, cancellation_reason, cancelled_at,
       created_at, updated_at, #created_by->PLAYER, #cancelled_by->PLAYER)

GAME (#id, name, universe, description, min_players, max_players,
      image_url, is_available, created_at, updated_at)

PLAYER_GAME (position, created_at, updated_at,
             #player_id->PLAYER, #game_id->GAME)
             UNIQUE(player_id, game_id)
             UNIQUE(player_id, position)

MEMBERSHIP (#id, season_start, season_end, status, paid_at, amount_cents,
            payment_method, source, external_reference, created_at, updated_at,
            #player_id->PLAYER, #recorded_by->PLAYER)
            UNIQUE(player_id, season_start)

CONTACT_MESSAGE (#id, author_name, email, phone, subject, message, status,
                 read_at, created_at, updated_at,
                 #player_id->PLAYER, #read_by->PLAYER)

GAME_TABLE (#id, table_number, max_players, status, created_at, updated_at,
            #event_id->EVENT, #game_id->GAME, #host_player_id->PLAYER)
            UNIQUE(event_id, table_number)

RESERVATION (#id, status, created_at, updated_at, cancelled_at,
             #player_id->PLAYER, #game_table_id->GAME_TABLE, #event_id->EVENT)
             UNIQUE(player_id, event_id) WHERE status = 'confirmed'

EVENT_ATTENDANCE (#id, table_number, game_name, attended, created_at,
                  #event_id->EVENT, #player_id->PLAYER,
                  #game_table_id->GAME_TABLE, #game_id->GAME)
                  UNIQUE(event_id, player_id)

BOOKING_ARCHIVE (#id, event_date, schema_version, snapshot, archived_at,
                 #event_id->EVENT)
                 UNIQUE(event_id)
