--
-- PostgreSQL database dump
--

-- Dumped from database version 15.2
-- Dumped by pg_dump version 15.2

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admin_event_entity; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.admin_event_entity (
    id character varying(36) NOT NULL,
    admin_event_time bigint,
    realm_id character varying(255),
    operation_type character varying(255),
    auth_realm_id character varying(255),
    auth_client_id character varying(255),
    auth_user_id character varying(255),
    ip_address character varying(255),
    resource_path character varying(2550),
    representation text,
    error character varying(255),
    resource_type character varying(64)
);


ALTER TABLE public.admin_event_entity OWNER TO postgres;

--
-- Name: associated_policy; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.associated_policy (
    policy_id character varying(36) NOT NULL,
    associated_policy_id character varying(36) NOT NULL
);


ALTER TABLE public.associated_policy OWNER TO postgres;

--
-- Name: authentication_execution; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.authentication_execution (
    id character varying(36) NOT NULL,
    alias character varying(255),
    authenticator character varying(36),
    realm_id character varying(36),
    flow_id character varying(36),
    requirement integer,
    priority integer,
    authenticator_flow boolean DEFAULT false NOT NULL,
    auth_flow_id character varying(36),
    auth_config character varying(36)
);


ALTER TABLE public.authentication_execution OWNER TO postgres;

--
-- Name: authentication_flow; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.authentication_flow (
    id character varying(36) NOT NULL,
    alias character varying(255),
    description character varying(255),
    realm_id character varying(36),
    provider_id character varying(36) DEFAULT 'basic-flow'::character varying NOT NULL,
    top_level boolean DEFAULT false NOT NULL,
    built_in boolean DEFAULT false NOT NULL
);


ALTER TABLE public.authentication_flow OWNER TO postgres;

--
-- Name: authenticator_config; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.authenticator_config (
    id character varying(36) NOT NULL,
    alias character varying(255),
    realm_id character varying(36)
);


ALTER TABLE public.authenticator_config OWNER TO postgres;

--
-- Name: authenticator_config_entry; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.authenticator_config_entry (
    authenticator_id character varying(36) NOT NULL,
    value text,
    name character varying(255) NOT NULL
);


ALTER TABLE public.authenticator_config_entry OWNER TO postgres;

--
-- Name: broker_link; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.broker_link (
    identity_provider character varying(255) NOT NULL,
    storage_provider_id character varying(255),
    realm_id character varying(36) NOT NULL,
    broker_user_id character varying(255),
    broker_username character varying(255),
    token text,
    user_id character varying(255) NOT NULL
);


ALTER TABLE public.broker_link OWNER TO postgres;

--
-- Name: client; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.client (
    id character varying(36) NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    full_scope_allowed boolean DEFAULT false NOT NULL,
    client_id character varying(255),
    not_before integer,
    public_client boolean DEFAULT false NOT NULL,
    secret character varying(255),
    base_url character varying(255),
    bearer_only boolean DEFAULT false NOT NULL,
    management_url character varying(255),
    surrogate_auth_required boolean DEFAULT false NOT NULL,
    realm_id character varying(36),
    protocol character varying(255),
    node_rereg_timeout integer DEFAULT 0,
    frontchannel_logout boolean DEFAULT false NOT NULL,
    consent_required boolean DEFAULT false NOT NULL,
    name character varying(255),
    service_accounts_enabled boolean DEFAULT false NOT NULL,
    client_authenticator_type character varying(255),
    root_url character varying(255),
    description character varying(255),
    registration_token character varying(255),
    standard_flow_enabled boolean DEFAULT true NOT NULL,
    implicit_flow_enabled boolean DEFAULT false NOT NULL,
    direct_access_grants_enabled boolean DEFAULT false NOT NULL,
    always_display_in_console boolean DEFAULT false NOT NULL
);


ALTER TABLE public.client OWNER TO postgres;

--
-- Name: client_attributes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.client_attributes (
    client_id character varying(36) NOT NULL,
    value character varying(4000),
    name character varying(255) NOT NULL
);


ALTER TABLE public.client_attributes OWNER TO postgres;

--
-- Name: client_auth_flow_bindings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.client_auth_flow_bindings (
    client_id character varying(36) NOT NULL,
    flow_id character varying(36),
    binding_name character varying(255) NOT NULL
);


ALTER TABLE public.client_auth_flow_bindings OWNER TO postgres;

--
-- Name: client_initial_access; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.client_initial_access (
    id character varying(36) NOT NULL,
    realm_id character varying(36) NOT NULL,
    "timestamp" integer,
    expiration integer,
    count integer,
    remaining_count integer
);


ALTER TABLE public.client_initial_access OWNER TO postgres;

--
-- Name: client_node_registrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.client_node_registrations (
    client_id character varying(36) NOT NULL,
    value integer,
    name character varying(255) NOT NULL
);


ALTER TABLE public.client_node_registrations OWNER TO postgres;

--
-- Name: client_scope; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.client_scope (
    id character varying(36) NOT NULL,
    name character varying(255),
    realm_id character varying(36),
    description character varying(255),
    protocol character varying(255)
);


ALTER TABLE public.client_scope OWNER TO postgres;

--
-- Name: client_scope_attributes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.client_scope_attributes (
    scope_id character varying(36) NOT NULL,
    value character varying(2048),
    name character varying(255) NOT NULL
);


ALTER TABLE public.client_scope_attributes OWNER TO postgres;

--
-- Name: client_scope_client; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.client_scope_client (
    client_id character varying(255) NOT NULL,
    scope_id character varying(255) NOT NULL,
    default_scope boolean DEFAULT false NOT NULL
);


ALTER TABLE public.client_scope_client OWNER TO postgres;

--
-- Name: client_scope_role_mapping; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.client_scope_role_mapping (
    scope_id character varying(36) NOT NULL,
    role_id character varying(36) NOT NULL
);


ALTER TABLE public.client_scope_role_mapping OWNER TO postgres;

--
-- Name: client_session; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.client_session (
    id character varying(36) NOT NULL,
    client_id character varying(36),
    redirect_uri character varying(255),
    state character varying(255),
    "timestamp" integer,
    session_id character varying(36),
    auth_method character varying(255),
    realm_id character varying(255),
    auth_user_id character varying(36),
    current_action character varying(36)
);


ALTER TABLE public.client_session OWNER TO postgres;

--
-- Name: client_session_auth_status; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.client_session_auth_status (
    authenticator character varying(36) NOT NULL,
    status integer,
    client_session character varying(36) NOT NULL
);


ALTER TABLE public.client_session_auth_status OWNER TO postgres;

--
-- Name: client_session_note; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.client_session_note (
    name character varying(255) NOT NULL,
    value character varying(255),
    client_session character varying(36) NOT NULL
);


ALTER TABLE public.client_session_note OWNER TO postgres;

--
-- Name: client_session_prot_mapper; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.client_session_prot_mapper (
    protocol_mapper_id character varying(36) NOT NULL,
    client_session character varying(36) NOT NULL
);


ALTER TABLE public.client_session_prot_mapper OWNER TO postgres;

--
-- Name: client_session_role; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.client_session_role (
    role_id character varying(255) NOT NULL,
    client_session character varying(36) NOT NULL
);


ALTER TABLE public.client_session_role OWNER TO postgres;

--
-- Name: client_user_session_note; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.client_user_session_note (
    name character varying(255) NOT NULL,
    value character varying(2048),
    client_session character varying(36) NOT NULL
);


ALTER TABLE public.client_user_session_note OWNER TO postgres;

--
-- Name: component; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.component (
    id character varying(36) NOT NULL,
    name character varying(255),
    parent_id character varying(36),
    provider_id character varying(36),
    provider_type character varying(255),
    realm_id character varying(36),
    sub_type character varying(255)
);


ALTER TABLE public.component OWNER TO postgres;

--
-- Name: component_config; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.component_config (
    id character varying(36) NOT NULL,
    component_id character varying(36) NOT NULL,
    name character varying(255) NOT NULL,
    value character varying(4000)
);


ALTER TABLE public.component_config OWNER TO postgres;

--
-- Name: composite_role; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.composite_role (
    composite character varying(36) NOT NULL,
    child_role character varying(36) NOT NULL
);


ALTER TABLE public.composite_role OWNER TO postgres;

--
-- Name: credential; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.credential (
    id character varying(36) NOT NULL,
    salt bytea,
    type character varying(255),
    user_id character varying(36),
    created_date bigint,
    user_label character varying(255),
    secret_data text,
    credential_data text,
    priority integer
);


ALTER TABLE public.credential OWNER TO postgres;

--
-- Name: databasechangelog; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.databasechangelog (
    id character varying(255) NOT NULL,
    author character varying(255) NOT NULL,
    filename character varying(255) NOT NULL,
    dateexecuted timestamp without time zone NOT NULL,
    orderexecuted integer NOT NULL,
    exectype character varying(10) NOT NULL,
    md5sum character varying(35),
    description character varying(255),
    comments character varying(255),
    tag character varying(255),
    liquibase character varying(20),
    contexts character varying(255),
    labels character varying(255),
    deployment_id character varying(10)
);


ALTER TABLE public.databasechangelog OWNER TO postgres;

--
-- Name: databasechangeloglock; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.databasechangeloglock (
    id integer NOT NULL,
    locked boolean NOT NULL,
    lockgranted timestamp without time zone,
    lockedby character varying(255)
);


ALTER TABLE public.databasechangeloglock OWNER TO postgres;

--
-- Name: default_client_scope; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.default_client_scope (
    realm_id character varying(36) NOT NULL,
    scope_id character varying(36) NOT NULL,
    default_scope boolean DEFAULT false NOT NULL
);


ALTER TABLE public.default_client_scope OWNER TO postgres;

--
-- Name: event_entity; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.event_entity (
    id character varying(36) NOT NULL,
    client_id character varying(255),
    details_json character varying(2550),
    error character varying(255),
    ip_address character varying(255),
    realm_id character varying(255),
    session_id character varying(255),
    event_time bigint,
    type character varying(255),
    user_id character varying(255)
);


ALTER TABLE public.event_entity OWNER TO postgres;

--
-- Name: fed_user_attribute; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fed_user_attribute (
    id character varying(36) NOT NULL,
    name character varying(255) NOT NULL,
    user_id character varying(255) NOT NULL,
    realm_id character varying(36) NOT NULL,
    storage_provider_id character varying(36),
    value character varying(2024)
);


ALTER TABLE public.fed_user_attribute OWNER TO postgres;

--
-- Name: fed_user_consent; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fed_user_consent (
    id character varying(36) NOT NULL,
    client_id character varying(255),
    user_id character varying(255) NOT NULL,
    realm_id character varying(36) NOT NULL,
    storage_provider_id character varying(36),
    created_date bigint,
    last_updated_date bigint,
    client_storage_provider character varying(36),
    external_client_id character varying(255)
);


ALTER TABLE public.fed_user_consent OWNER TO postgres;

--
-- Name: fed_user_consent_cl_scope; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fed_user_consent_cl_scope (
    user_consent_id character varying(36) NOT NULL,
    scope_id character varying(36) NOT NULL
);


ALTER TABLE public.fed_user_consent_cl_scope OWNER TO postgres;

--
-- Name: fed_user_credential; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fed_user_credential (
    id character varying(36) NOT NULL,
    salt bytea,
    type character varying(255),
    created_date bigint,
    user_id character varying(255) NOT NULL,
    realm_id character varying(36) NOT NULL,
    storage_provider_id character varying(36),
    user_label character varying(255),
    secret_data text,
    credential_data text,
    priority integer
);


ALTER TABLE public.fed_user_credential OWNER TO postgres;

--
-- Name: fed_user_group_membership; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fed_user_group_membership (
    group_id character varying(36) NOT NULL,
    user_id character varying(255) NOT NULL,
    realm_id character varying(36) NOT NULL,
    storage_provider_id character varying(36)
);


ALTER TABLE public.fed_user_group_membership OWNER TO postgres;

--
-- Name: fed_user_required_action; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fed_user_required_action (
    required_action character varying(255) DEFAULT ' '::character varying NOT NULL,
    user_id character varying(255) NOT NULL,
    realm_id character varying(36) NOT NULL,
    storage_provider_id character varying(36)
);


ALTER TABLE public.fed_user_required_action OWNER TO postgres;

--
-- Name: fed_user_role_mapping; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fed_user_role_mapping (
    role_id character varying(36) NOT NULL,
    user_id character varying(255) NOT NULL,
    realm_id character varying(36) NOT NULL,
    storage_provider_id character varying(36)
);


ALTER TABLE public.fed_user_role_mapping OWNER TO postgres;

--
-- Name: federated_identity; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.federated_identity (
    identity_provider character varying(255) NOT NULL,
    realm_id character varying(36),
    federated_user_id character varying(255),
    federated_username character varying(255),
    token text,
    user_id character varying(36) NOT NULL
);


ALTER TABLE public.federated_identity OWNER TO postgres;

--
-- Name: federated_user; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.federated_user (
    id character varying(255) NOT NULL,
    storage_provider_id character varying(255),
    realm_id character varying(36) NOT NULL
);


ALTER TABLE public.federated_user OWNER TO postgres;

--
-- Name: group_attribute; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.group_attribute (
    id character varying(36) DEFAULT 'sybase-needs-something-here'::character varying NOT NULL,
    name character varying(255) NOT NULL,
    value character varying(255),
    group_id character varying(36) NOT NULL
);


ALTER TABLE public.group_attribute OWNER TO postgres;

--
-- Name: group_role_mapping; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.group_role_mapping (
    role_id character varying(36) NOT NULL,
    group_id character varying(36) NOT NULL
);


ALTER TABLE public.group_role_mapping OWNER TO postgres;

--
-- Name: identity_provider; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.identity_provider (
    internal_id character varying(36) NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    provider_alias character varying(255),
    provider_id character varying(255),
    store_token boolean DEFAULT false NOT NULL,
    authenticate_by_default boolean DEFAULT false NOT NULL,
    realm_id character varying(36),
    add_token_role boolean DEFAULT true NOT NULL,
    trust_email boolean DEFAULT false NOT NULL,
    first_broker_login_flow_id character varying(36),
    post_broker_login_flow_id character varying(36),
    provider_display_name character varying(255),
    link_only boolean DEFAULT false NOT NULL
);


ALTER TABLE public.identity_provider OWNER TO postgres;

--
-- Name: identity_provider_config; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.identity_provider_config (
    identity_provider_id character varying(36) NOT NULL,
    value text,
    name character varying(255) NOT NULL
);


ALTER TABLE public.identity_provider_config OWNER TO postgres;

--
-- Name: identity_provider_mapper; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.identity_provider_mapper (
    id character varying(36) NOT NULL,
    name character varying(255) NOT NULL,
    idp_alias character varying(255) NOT NULL,
    idp_mapper_name character varying(255) NOT NULL,
    realm_id character varying(36) NOT NULL
);


ALTER TABLE public.identity_provider_mapper OWNER TO postgres;

--
-- Name: idp_mapper_config; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.idp_mapper_config (
    idp_mapper_id character varying(36) NOT NULL,
    value text,
    name character varying(255) NOT NULL
);


ALTER TABLE public.idp_mapper_config OWNER TO postgres;

--
-- Name: keycloak_group; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.keycloak_group (
    id character varying(36) NOT NULL,
    name character varying(255),
    parent_group character varying(36) NOT NULL,
    realm_id character varying(36)
);


ALTER TABLE public.keycloak_group OWNER TO postgres;

--
-- Name: keycloak_role; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.keycloak_role (
    id character varying(36) NOT NULL,
    client_realm_constraint character varying(255),
    client_role boolean DEFAULT false NOT NULL,
    description character varying(255),
    name character varying(255),
    realm_id character varying(255),
    client character varying(36),
    realm character varying(36)
);


ALTER TABLE public.keycloak_role OWNER TO postgres;

--
-- Name: migration_model; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.migration_model (
    id character varying(36) NOT NULL,
    version character varying(36),
    update_time bigint DEFAULT 0 NOT NULL
);


ALTER TABLE public.migration_model OWNER TO postgres;

--
-- Name: offline_client_session; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.offline_client_session (
    user_session_id character varying(36) NOT NULL,
    client_id character varying(255) NOT NULL,
    offline_flag character varying(4) NOT NULL,
    "timestamp" integer,
    data text,
    client_storage_provider character varying(36) DEFAULT 'local'::character varying NOT NULL,
    external_client_id character varying(255) DEFAULT 'local'::character varying NOT NULL
);


ALTER TABLE public.offline_client_session OWNER TO postgres;

--
-- Name: offline_user_session; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.offline_user_session (
    user_session_id character varying(36) NOT NULL,
    user_id character varying(255) NOT NULL,
    realm_id character varying(36) NOT NULL,
    created_on integer NOT NULL,
    offline_flag character varying(4) NOT NULL,
    data text,
    last_session_refresh integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.offline_user_session OWNER TO postgres;

--
-- Name: policy_config; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.policy_config (
    policy_id character varying(36) NOT NULL,
    name character varying(255) NOT NULL,
    value text
);


ALTER TABLE public.policy_config OWNER TO postgres;

--
-- Name: protocol_mapper; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.protocol_mapper (
    id character varying(36) NOT NULL,
    name character varying(255) NOT NULL,
    protocol character varying(255) NOT NULL,
    protocol_mapper_name character varying(255) NOT NULL,
    client_id character varying(36),
    client_scope_id character varying(36)
);


ALTER TABLE public.protocol_mapper OWNER TO postgres;

--
-- Name: protocol_mapper_config; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.protocol_mapper_config (
    protocol_mapper_id character varying(36) NOT NULL,
    value text,
    name character varying(255) NOT NULL
);


ALTER TABLE public.protocol_mapper_config OWNER TO postgres;

--
-- Name: realm; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.realm (
    id character varying(36) NOT NULL,
    access_code_lifespan integer,
    user_action_lifespan integer,
    access_token_lifespan integer,
    account_theme character varying(255),
    admin_theme character varying(255),
    email_theme character varying(255),
    enabled boolean DEFAULT false NOT NULL,
    events_enabled boolean DEFAULT false NOT NULL,
    events_expiration bigint,
    login_theme character varying(255),
    name character varying(255),
    not_before integer,
    password_policy character varying(2550),
    registration_allowed boolean DEFAULT false NOT NULL,
    remember_me boolean DEFAULT false NOT NULL,
    reset_password_allowed boolean DEFAULT false NOT NULL,
    social boolean DEFAULT false NOT NULL,
    ssl_required character varying(255),
    sso_idle_timeout integer,
    sso_max_lifespan integer,
    update_profile_on_soc_login boolean DEFAULT false NOT NULL,
    verify_email boolean DEFAULT false NOT NULL,
    master_admin_client character varying(36),
    login_lifespan integer,
    internationalization_enabled boolean DEFAULT false NOT NULL,
    default_locale character varying(255),
    reg_email_as_username boolean DEFAULT false NOT NULL,
    admin_events_enabled boolean DEFAULT false NOT NULL,
    admin_events_details_enabled boolean DEFAULT false NOT NULL,
    edit_username_allowed boolean DEFAULT false NOT NULL,
    otp_policy_counter integer DEFAULT 0,
    otp_policy_window integer DEFAULT 1,
    otp_policy_period integer DEFAULT 30,
    otp_policy_digits integer DEFAULT 6,
    otp_policy_alg character varying(36) DEFAULT 'HmacSHA1'::character varying,
    otp_policy_type character varying(36) DEFAULT 'totp'::character varying,
    browser_flow character varying(36),
    registration_flow character varying(36),
    direct_grant_flow character varying(36),
    reset_credentials_flow character varying(36),
    client_auth_flow character varying(36),
    offline_session_idle_timeout integer DEFAULT 0,
    revoke_refresh_token boolean DEFAULT false NOT NULL,
    access_token_life_implicit integer DEFAULT 0,
    login_with_email_allowed boolean DEFAULT true NOT NULL,
    duplicate_emails_allowed boolean DEFAULT false NOT NULL,
    docker_auth_flow character varying(36),
    refresh_token_max_reuse integer DEFAULT 0,
    allow_user_managed_access boolean DEFAULT false NOT NULL,
    sso_max_lifespan_remember_me integer DEFAULT 0 NOT NULL,
    sso_idle_timeout_remember_me integer DEFAULT 0 NOT NULL,
    default_role character varying(255)
);


ALTER TABLE public.realm OWNER TO postgres;

--
-- Name: realm_attribute; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.realm_attribute (
    name character varying(255) NOT NULL,
    realm_id character varying(36) NOT NULL,
    value text
);


ALTER TABLE public.realm_attribute OWNER TO postgres;

--
-- Name: realm_default_groups; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.realm_default_groups (
    realm_id character varying(36) NOT NULL,
    group_id character varying(36) NOT NULL
);


ALTER TABLE public.realm_default_groups OWNER TO postgres;

--
-- Name: realm_enabled_event_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.realm_enabled_event_types (
    realm_id character varying(36) NOT NULL,
    value character varying(255) NOT NULL
);


ALTER TABLE public.realm_enabled_event_types OWNER TO postgres;

--
-- Name: realm_events_listeners; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.realm_events_listeners (
    realm_id character varying(36) NOT NULL,
    value character varying(255) NOT NULL
);


ALTER TABLE public.realm_events_listeners OWNER TO postgres;

--
-- Name: realm_localizations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.realm_localizations (
    realm_id character varying(255) NOT NULL,
    locale character varying(255) NOT NULL,
    texts text NOT NULL
);


ALTER TABLE public.realm_localizations OWNER TO postgres;

--
-- Name: realm_required_credential; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.realm_required_credential (
    type character varying(255) NOT NULL,
    form_label character varying(255),
    input boolean DEFAULT false NOT NULL,
    secret boolean DEFAULT false NOT NULL,
    realm_id character varying(36) NOT NULL
);


ALTER TABLE public.realm_required_credential OWNER TO postgres;

--
-- Name: realm_smtp_config; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.realm_smtp_config (
    realm_id character varying(36) NOT NULL,
    value character varying(255),
    name character varying(255) NOT NULL
);


ALTER TABLE public.realm_smtp_config OWNER TO postgres;

--
-- Name: realm_supported_locales; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.realm_supported_locales (
    realm_id character varying(36) NOT NULL,
    value character varying(255) NOT NULL
);


ALTER TABLE public.realm_supported_locales OWNER TO postgres;

--
-- Name: redirect_uris; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.redirect_uris (
    client_id character varying(36) NOT NULL,
    value character varying(255) NOT NULL
);


ALTER TABLE public.redirect_uris OWNER TO postgres;

--
-- Name: required_action_config; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.required_action_config (
    required_action_id character varying(36) NOT NULL,
    value text,
    name character varying(255) NOT NULL
);


ALTER TABLE public.required_action_config OWNER TO postgres;

--
-- Name: required_action_provider; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.required_action_provider (
    id character varying(36) NOT NULL,
    alias character varying(255),
    name character varying(255),
    realm_id character varying(36),
    enabled boolean DEFAULT false NOT NULL,
    default_action boolean DEFAULT false NOT NULL,
    provider_id character varying(255),
    priority integer
);


ALTER TABLE public.required_action_provider OWNER TO postgres;

--
-- Name: resource_attribute; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.resource_attribute (
    id character varying(36) DEFAULT 'sybase-needs-something-here'::character varying NOT NULL,
    name character varying(255) NOT NULL,
    value character varying(255),
    resource_id character varying(36) NOT NULL
);


ALTER TABLE public.resource_attribute OWNER TO postgres;

--
-- Name: resource_policy; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.resource_policy (
    resource_id character varying(36) NOT NULL,
    policy_id character varying(36) NOT NULL
);


ALTER TABLE public.resource_policy OWNER TO postgres;

--
-- Name: resource_scope; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.resource_scope (
    resource_id character varying(36) NOT NULL,
    scope_id character varying(36) NOT NULL
);


ALTER TABLE public.resource_scope OWNER TO postgres;

--
-- Name: resource_server; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.resource_server (
    id character varying(36) NOT NULL,
    allow_rs_remote_mgmt boolean DEFAULT false NOT NULL,
    policy_enforce_mode character varying(15) NOT NULL,
    decision_strategy smallint DEFAULT 1 NOT NULL
);


ALTER TABLE public.resource_server OWNER TO postgres;

--
-- Name: resource_server_perm_ticket; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.resource_server_perm_ticket (
    id character varying(36) NOT NULL,
    owner character varying(255) NOT NULL,
    requester character varying(255) NOT NULL,
    created_timestamp bigint NOT NULL,
    granted_timestamp bigint,
    resource_id character varying(36) NOT NULL,
    scope_id character varying(36),
    resource_server_id character varying(36) NOT NULL,
    policy_id character varying(36)
);


ALTER TABLE public.resource_server_perm_ticket OWNER TO postgres;

--
-- Name: resource_server_policy; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.resource_server_policy (
    id character varying(36) NOT NULL,
    name character varying(255) NOT NULL,
    description character varying(255),
    type character varying(255) NOT NULL,
    decision_strategy character varying(20),
    logic character varying(20),
    resource_server_id character varying(36) NOT NULL,
    owner character varying(255)
);


ALTER TABLE public.resource_server_policy OWNER TO postgres;

--
-- Name: resource_server_resource; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.resource_server_resource (
    id character varying(36) NOT NULL,
    name character varying(255) NOT NULL,
    type character varying(255),
    icon_uri character varying(255),
    owner character varying(255) NOT NULL,
    resource_server_id character varying(36) NOT NULL,
    owner_managed_access boolean DEFAULT false NOT NULL,
    display_name character varying(255)
);


ALTER TABLE public.resource_server_resource OWNER TO postgres;

--
-- Name: resource_server_scope; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.resource_server_scope (
    id character varying(36) NOT NULL,
    name character varying(255) NOT NULL,
    icon_uri character varying(255),
    resource_server_id character varying(36) NOT NULL,
    display_name character varying(255)
);


ALTER TABLE public.resource_server_scope OWNER TO postgres;

--
-- Name: resource_uris; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.resource_uris (
    resource_id character varying(36) NOT NULL,
    value character varying(255) NOT NULL
);


ALTER TABLE public.resource_uris OWNER TO postgres;

--
-- Name: role_attribute; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.role_attribute (
    id character varying(36) NOT NULL,
    role_id character varying(36) NOT NULL,
    name character varying(255) NOT NULL,
    value character varying(255)
);


ALTER TABLE public.role_attribute OWNER TO postgres;

--
-- Name: scope_mapping; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.scope_mapping (
    client_id character varying(36) NOT NULL,
    role_id character varying(36) NOT NULL
);


ALTER TABLE public.scope_mapping OWNER TO postgres;

--
-- Name: scope_policy; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.scope_policy (
    scope_id character varying(36) NOT NULL,
    policy_id character varying(36) NOT NULL
);


ALTER TABLE public.scope_policy OWNER TO postgres;

--
-- Name: user_attribute; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_attribute (
    name character varying(255) NOT NULL,
    value character varying(255),
    user_id character varying(36) NOT NULL,
    id character varying(36) DEFAULT 'sybase-needs-something-here'::character varying NOT NULL
);


ALTER TABLE public.user_attribute OWNER TO postgres;

--
-- Name: user_consent; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_consent (
    id character varying(36) NOT NULL,
    client_id character varying(255),
    user_id character varying(36) NOT NULL,
    created_date bigint,
    last_updated_date bigint,
    client_storage_provider character varying(36),
    external_client_id character varying(255)
);


ALTER TABLE public.user_consent OWNER TO postgres;

--
-- Name: user_consent_client_scope; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_consent_client_scope (
    user_consent_id character varying(36) NOT NULL,
    scope_id character varying(36) NOT NULL
);


ALTER TABLE public.user_consent_client_scope OWNER TO postgres;

--
-- Name: user_entity; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_entity (
    id character varying(36) NOT NULL,
    email character varying(255),
    email_constraint character varying(255),
    email_verified boolean DEFAULT false NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    federation_link character varying(255),
    first_name character varying(255),
    last_name character varying(255),
    realm_id character varying(255),
    username character varying(255),
    created_timestamp bigint,
    service_account_client_link character varying(255),
    not_before integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.user_entity OWNER TO postgres;

--
-- Name: user_federation_config; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_federation_config (
    user_federation_provider_id character varying(36) NOT NULL,
    value character varying(255),
    name character varying(255) NOT NULL
);


ALTER TABLE public.user_federation_config OWNER TO postgres;

--
-- Name: user_federation_mapper; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_federation_mapper (
    id character varying(36) NOT NULL,
    name character varying(255) NOT NULL,
    federation_provider_id character varying(36) NOT NULL,
    federation_mapper_type character varying(255) NOT NULL,
    realm_id character varying(36) NOT NULL
);


ALTER TABLE public.user_federation_mapper OWNER TO postgres;

--
-- Name: user_federation_mapper_config; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_federation_mapper_config (
    user_federation_mapper_id character varying(36) NOT NULL,
    value character varying(255),
    name character varying(255) NOT NULL
);


ALTER TABLE public.user_federation_mapper_config OWNER TO postgres;

--
-- Name: user_federation_provider; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_federation_provider (
    id character varying(36) NOT NULL,
    changed_sync_period integer,
    display_name character varying(255),
    full_sync_period integer,
    last_sync integer,
    priority integer,
    provider_name character varying(255),
    realm_id character varying(36)
);


ALTER TABLE public.user_federation_provider OWNER TO postgres;

--
-- Name: user_group_membership; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_group_membership (
    group_id character varying(36) NOT NULL,
    user_id character varying(36) NOT NULL
);


ALTER TABLE public.user_group_membership OWNER TO postgres;

--
-- Name: user_required_action; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_required_action (
    user_id character varying(36) NOT NULL,
    required_action character varying(255) DEFAULT ' '::character varying NOT NULL
);


ALTER TABLE public.user_required_action OWNER TO postgres;

--
-- Name: user_role_mapping; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_role_mapping (
    role_id character varying(255) NOT NULL,
    user_id character varying(36) NOT NULL
);


ALTER TABLE public.user_role_mapping OWNER TO postgres;

--
-- Name: user_session; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_session (
    id character varying(36) NOT NULL,
    auth_method character varying(255),
    ip_address character varying(255),
    last_session_refresh integer,
    login_username character varying(255),
    realm_id character varying(255),
    remember_me boolean DEFAULT false NOT NULL,
    started integer,
    user_id character varying(255),
    user_session_state integer,
    broker_session_id character varying(255),
    broker_user_id character varying(255)
);


ALTER TABLE public.user_session OWNER TO postgres;

--
-- Name: user_session_note; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_session_note (
    user_session character varying(36) NOT NULL,
    name character varying(255) NOT NULL,
    value character varying(2048)
);


ALTER TABLE public.user_session_note OWNER TO postgres;

--
-- Name: username_login_failure; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.username_login_failure (
    realm_id character varying(36) NOT NULL,
    username character varying(255) NOT NULL,
    failed_login_not_before integer,
    last_failure bigint,
    last_ip_failure character varying(255),
    num_failures integer
);


ALTER TABLE public.username_login_failure OWNER TO postgres;

--
-- Name: web_origins; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.web_origins (
    client_id character varying(36) NOT NULL,
    value character varying(255) NOT NULL
);


ALTER TABLE public.web_origins OWNER TO postgres;

--
-- Data for Name: admin_event_entity; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.admin_event_entity (id, admin_event_time, realm_id, operation_type, auth_realm_id, auth_client_id, auth_user_id, ip_address, resource_path, representation, error, resource_type) FROM stdin;
\.


--
-- Data for Name: associated_policy; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.associated_policy (policy_id, associated_policy_id) FROM stdin;
\.


--
-- Data for Name: authentication_execution; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.authentication_execution (id, alias, authenticator, realm_id, flow_id, requirement, priority, authenticator_flow, auth_flow_id, auth_config) FROM stdin;
819c1a3d-9271-43fa-aae9-14189e961dd3	\N	auth-cookie	65e9a13f-13e5-431c-8500-c136a2014a70	fe605ee4-a865-4142-8ad5-2ff12a1816d1	2	10	f	\N	\N
6850ec91-a8ee-4f69-aeff-c3de9fd0eeda	\N	auth-spnego	65e9a13f-13e5-431c-8500-c136a2014a70	fe605ee4-a865-4142-8ad5-2ff12a1816d1	3	20	f	\N	\N
77020749-896e-4588-bc52-95d2e33d49e5	\N	identity-provider-redirector	65e9a13f-13e5-431c-8500-c136a2014a70	fe605ee4-a865-4142-8ad5-2ff12a1816d1	2	25	f	\N	\N
849e4c16-12a9-426c-9a6e-516bd94efe70	\N	\N	65e9a13f-13e5-431c-8500-c136a2014a70	fe605ee4-a865-4142-8ad5-2ff12a1816d1	2	30	t	c0fc42a5-a993-4ad0-b49a-84015c06ef43	\N
40a71424-3119-448d-b85b-b67669248969	\N	auth-username-password-form	65e9a13f-13e5-431c-8500-c136a2014a70	c0fc42a5-a993-4ad0-b49a-84015c06ef43	0	10	f	\N	\N
06f529e8-98f7-4f15-a7af-3747585bdc74	\N	\N	65e9a13f-13e5-431c-8500-c136a2014a70	c0fc42a5-a993-4ad0-b49a-84015c06ef43	1	20	t	15c58270-85de-4fe9-90fa-100594e19a0f	\N
3500fe87-47a1-4ed4-a57e-cb16d1855acb	\N	conditional-user-configured	65e9a13f-13e5-431c-8500-c136a2014a70	15c58270-85de-4fe9-90fa-100594e19a0f	0	10	f	\N	\N
2e8ec063-718e-41ff-8c54-659ea9ea5e79	\N	auth-otp-form	65e9a13f-13e5-431c-8500-c136a2014a70	15c58270-85de-4fe9-90fa-100594e19a0f	0	20	f	\N	\N
6a449d9e-9724-457c-a42b-67fdcb417f59	\N	direct-grant-validate-username	65e9a13f-13e5-431c-8500-c136a2014a70	04e8e7ab-6450-4440-9a6f-6e0edafe5589	0	10	f	\N	\N
66ffe302-b28a-4227-a199-71217d78cb34	\N	direct-grant-validate-password	65e9a13f-13e5-431c-8500-c136a2014a70	04e8e7ab-6450-4440-9a6f-6e0edafe5589	0	20	f	\N	\N
0858e79f-23f2-4e7f-8beb-09c455637801	\N	\N	65e9a13f-13e5-431c-8500-c136a2014a70	04e8e7ab-6450-4440-9a6f-6e0edafe5589	1	30	t	b37ff42b-b462-46d7-955e-6fcf0e8d4d99	\N
36f6e4d6-511c-4004-b507-ed283e569461	\N	conditional-user-configured	65e9a13f-13e5-431c-8500-c136a2014a70	b37ff42b-b462-46d7-955e-6fcf0e8d4d99	0	10	f	\N	\N
a58ed261-0226-4543-9e94-d3957ff623a8	\N	direct-grant-validate-otp	65e9a13f-13e5-431c-8500-c136a2014a70	b37ff42b-b462-46d7-955e-6fcf0e8d4d99	0	20	f	\N	\N
f6c7465c-36cb-46b2-a06f-6fdd0390830b	\N	registration-page-form	65e9a13f-13e5-431c-8500-c136a2014a70	89e71be5-0fce-4c06-a542-6b6f8952444d	0	10	t	aecfd1ec-89ad-4cf9-9ebb-84744032537a	\N
c87f7cc1-f2f6-4f64-a2fa-9f4ba454def0	\N	registration-user-creation	65e9a13f-13e5-431c-8500-c136a2014a70	aecfd1ec-89ad-4cf9-9ebb-84744032537a	0	20	f	\N	\N
21bc6c6a-7f11-43c9-98fa-13f8b8ec2cd7	\N	registration-profile-action	65e9a13f-13e5-431c-8500-c136a2014a70	aecfd1ec-89ad-4cf9-9ebb-84744032537a	0	40	f	\N	\N
894e9fa6-dd4b-4f1e-9d10-c240ff61e5dc	\N	registration-password-action	65e9a13f-13e5-431c-8500-c136a2014a70	aecfd1ec-89ad-4cf9-9ebb-84744032537a	0	50	f	\N	\N
0c571913-9dfe-4ebc-b8ed-9df8ad5a5d4c	\N	registration-recaptcha-action	65e9a13f-13e5-431c-8500-c136a2014a70	aecfd1ec-89ad-4cf9-9ebb-84744032537a	3	60	f	\N	\N
7b89e717-96ba-4d94-8c22-e6d311881817	\N	reset-credentials-choose-user	65e9a13f-13e5-431c-8500-c136a2014a70	3c8babf4-e626-45a8-9fa2-35c503e7a05b	0	10	f	\N	\N
663812c9-a5f2-46e6-93c5-17c3cd1f5381	\N	reset-credential-email	65e9a13f-13e5-431c-8500-c136a2014a70	3c8babf4-e626-45a8-9fa2-35c503e7a05b	0	20	f	\N	\N
6ddb4d3a-f099-409d-bd9c-1c4513099e10	\N	reset-password	65e9a13f-13e5-431c-8500-c136a2014a70	3c8babf4-e626-45a8-9fa2-35c503e7a05b	0	30	f	\N	\N
41b1cc06-3f2d-49e1-9b11-cb18ffde28c2	\N	\N	65e9a13f-13e5-431c-8500-c136a2014a70	3c8babf4-e626-45a8-9fa2-35c503e7a05b	1	40	t	60e2db73-339a-45bb-82c4-96d1434c7296	\N
0139ec1d-9b1b-4f00-a8ac-ec5915bb9e63	\N	conditional-user-configured	65e9a13f-13e5-431c-8500-c136a2014a70	60e2db73-339a-45bb-82c4-96d1434c7296	0	10	f	\N	\N
5ad223bf-58bb-400e-aef8-275ac6114f41	\N	reset-otp	65e9a13f-13e5-431c-8500-c136a2014a70	60e2db73-339a-45bb-82c4-96d1434c7296	0	20	f	\N	\N
4ebaf0d5-ac0d-4761-8777-7d6ece803dfd	\N	client-secret	65e9a13f-13e5-431c-8500-c136a2014a70	7bcb46cd-c5c1-4f5b-8333-82449cfa5b13	2	10	f	\N	\N
527436d4-bc41-4a8a-8b48-c36a500cd8ca	\N	client-jwt	65e9a13f-13e5-431c-8500-c136a2014a70	7bcb46cd-c5c1-4f5b-8333-82449cfa5b13	2	20	f	\N	\N
85d54344-cacb-41bb-b052-28695a329ee8	\N	client-secret-jwt	65e9a13f-13e5-431c-8500-c136a2014a70	7bcb46cd-c5c1-4f5b-8333-82449cfa5b13	2	30	f	\N	\N
bf9b426b-1f7b-45c7-8610-91091284a61c	\N	client-x509	65e9a13f-13e5-431c-8500-c136a2014a70	7bcb46cd-c5c1-4f5b-8333-82449cfa5b13	2	40	f	\N	\N
ca559a23-8280-425e-9fd2-b6d4ea27d44d	\N	idp-review-profile	65e9a13f-13e5-431c-8500-c136a2014a70	c24c9c4c-1943-482f-ab78-0f2594b3b61d	0	10	f	\N	daa67f59-66dc-426e-9401-d808b42e7dd7
1e84858e-3f78-4d7c-8aab-7dc619ee3069	\N	\N	65e9a13f-13e5-431c-8500-c136a2014a70	c24c9c4c-1943-482f-ab78-0f2594b3b61d	0	20	t	3c6fa816-b307-44b6-8aed-b8a673e94180	\N
f2d248be-36c2-4d69-8dcf-843273ec7921	\N	idp-create-user-if-unique	65e9a13f-13e5-431c-8500-c136a2014a70	3c6fa816-b307-44b6-8aed-b8a673e94180	2	10	f	\N	73c5fb45-df04-47da-947e-55ad15cde85a
97992b51-f6cc-4e6f-bd3a-ca48ad918314	\N	\N	65e9a13f-13e5-431c-8500-c136a2014a70	3c6fa816-b307-44b6-8aed-b8a673e94180	2	20	t	e8a4b1b1-6d5d-4ead-9f1e-6658d872939c	\N
be00542a-a61f-4b6f-a57f-4940341c4910	\N	idp-confirm-link	65e9a13f-13e5-431c-8500-c136a2014a70	e8a4b1b1-6d5d-4ead-9f1e-6658d872939c	0	10	f	\N	\N
fccfb1df-d7e4-467d-81e9-849986d25f57	\N	\N	65e9a13f-13e5-431c-8500-c136a2014a70	e8a4b1b1-6d5d-4ead-9f1e-6658d872939c	0	20	t	768dccfd-6e6d-4efc-a26f-2d35e619ab02	\N
840277b8-c733-48ba-b5bc-8ce757da40d2	\N	idp-email-verification	65e9a13f-13e5-431c-8500-c136a2014a70	768dccfd-6e6d-4efc-a26f-2d35e619ab02	2	10	f	\N	\N
cfd62098-694d-4409-93e2-95b82d18451e	\N	\N	65e9a13f-13e5-431c-8500-c136a2014a70	768dccfd-6e6d-4efc-a26f-2d35e619ab02	2	20	t	2537c4d7-339e-45d3-a75a-d0062ab34e3e	\N
c2f6bdd0-2212-4446-a529-8481fc6ae860	\N	idp-username-password-form	65e9a13f-13e5-431c-8500-c136a2014a70	2537c4d7-339e-45d3-a75a-d0062ab34e3e	0	10	f	\N	\N
43cf12ca-00ab-40ab-9e8b-0b78204f8ab6	\N	\N	65e9a13f-13e5-431c-8500-c136a2014a70	2537c4d7-339e-45d3-a75a-d0062ab34e3e	1	20	t	efc248bb-a16a-4fea-aba6-24be4a264b86	\N
a8683bec-0990-4b74-a28e-4d6c14e776aa	\N	conditional-user-configured	65e9a13f-13e5-431c-8500-c136a2014a70	efc248bb-a16a-4fea-aba6-24be4a264b86	0	10	f	\N	\N
0e7ff7af-ebde-4c96-9347-06b023b72059	\N	auth-otp-form	65e9a13f-13e5-431c-8500-c136a2014a70	efc248bb-a16a-4fea-aba6-24be4a264b86	0	20	f	\N	\N
26d65ec1-a137-45b9-983a-03211fd74038	\N	http-basic-authenticator	65e9a13f-13e5-431c-8500-c136a2014a70	3fa9d297-9911-4eb1-9f99-e76ae8ccd132	0	10	f	\N	\N
1499e3be-4475-4c06-83ed-edcdbb0f9f8c	\N	docker-http-basic-authenticator	65e9a13f-13e5-431c-8500-c136a2014a70	9f04ad5f-f308-4f56-82ac-2e96fc0aa0bb	0	10	f	\N	\N
a8a9c3ab-b5a8-41f8-9f13-39fad503ef19	\N	no-cookie-redirect	65e9a13f-13e5-431c-8500-c136a2014a70	d1ab1db5-d2f7-46c3-afaf-6d412c7de78c	0	10	f	\N	\N
c31c383b-cba7-4060-8369-8213f88bd31a	\N	\N	65e9a13f-13e5-431c-8500-c136a2014a70	d1ab1db5-d2f7-46c3-afaf-6d412c7de78c	0	20	t	f94250d3-72d9-41f8-a80b-95fe80651360	\N
a846872a-1744-47f3-bdcd-467fcafb29fc	\N	basic-auth	65e9a13f-13e5-431c-8500-c136a2014a70	f94250d3-72d9-41f8-a80b-95fe80651360	0	10	f	\N	\N
401750b6-1d22-418b-9182-0d26d5601cd6	\N	basic-auth-otp	65e9a13f-13e5-431c-8500-c136a2014a70	f94250d3-72d9-41f8-a80b-95fe80651360	3	20	f	\N	\N
b28b9e90-bc09-4df3-b6eb-d3a79a957aa5	\N	auth-spnego	65e9a13f-13e5-431c-8500-c136a2014a70	f94250d3-72d9-41f8-a80b-95fe80651360	3	30	f	\N	\N
5b82050b-867c-4fe1-beb5-501fb2126abb	\N	idp-email-verification	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	809cde89-3357-4ccb-8eb6-4134fad6e1e7	2	10	f	\N	\N
89294fc9-688c-456f-a677-7ae490591e7b	\N	\N	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	809cde89-3357-4ccb-8eb6-4134fad6e1e7	2	20	t	35ded041-14f8-4334-98c5-439db8433b96	\N
97b0d57b-9685-4761-b869-39fb30b61225	\N	basic-auth	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	0a18975a-4db0-499a-86a4-3eba6b3bb61a	0	10	f	\N	\N
8e2267d9-fbb8-406f-aeb3-b189340e764d	\N	basic-auth-otp	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	0a18975a-4db0-499a-86a4-3eba6b3bb61a	3	20	f	\N	\N
811ef71c-7dd8-47bf-9023-1ddb4cce3aa4	\N	auth-spnego	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	0a18975a-4db0-499a-86a4-3eba6b3bb61a	3	30	f	\N	\N
2eee1e9c-c9c2-416d-bb30-ddb855c78803	\N	conditional-user-configured	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	35bfcddc-3ad3-4895-866a-cfd8332011d4	0	10	f	\N	\N
739e1dcf-21c0-44d5-a85e-bfa4d4ef5870	\N	auth-otp-form	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	35bfcddc-3ad3-4895-866a-cfd8332011d4	0	20	f	\N	\N
36dec30b-714b-49f5-b623-edba06b7606c	\N	conditional-user-configured	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	1206f2de-2dfc-42dd-b69d-37fc96ef1aae	0	10	f	\N	\N
8bb772ce-8e9b-4139-951e-de04db61d6c5	\N	direct-grant-validate-otp	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	1206f2de-2dfc-42dd-b69d-37fc96ef1aae	0	20	f	\N	\N
11cbf9fe-69d3-406f-8c9b-2940870233c9	\N	conditional-user-configured	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	fd87fcb1-225a-40dc-b269-c9432b0c8e2c	0	10	f	\N	\N
3eb7e4fb-7bf9-4380-9f1c-abc25cdf9b42	\N	auth-otp-form	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	fd87fcb1-225a-40dc-b269-c9432b0c8e2c	0	20	f	\N	\N
e86ca32c-320c-4559-9a6d-1f0aaaa316a8	\N	idp-confirm-link	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	a961e53a-20cc-499f-8773-a9e18c62aa63	0	10	f	\N	\N
69ec751f-1aa6-4814-8794-0b5fa70280a7	\N	\N	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	a961e53a-20cc-499f-8773-a9e18c62aa63	0	20	t	809cde89-3357-4ccb-8eb6-4134fad6e1e7	\N
e874a293-322b-4596-ab77-dd23d6ba96a5	\N	conditional-user-configured	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	b073676d-e183-4a02-beab-3e1d48062a49	0	10	f	\N	\N
3694c48c-5ea1-4f7b-a958-b25dce7e252a	\N	reset-otp	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	b073676d-e183-4a02-beab-3e1d48062a49	0	20	f	\N	\N
efdf5b91-daa0-4aaf-ad61-d0ecb00c674b	\N	idp-create-user-if-unique	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	819870ec-e5e0-496e-9607-f84ce11db329	2	10	f	\N	6cb685bc-eec3-48eb-995a-dcea1a47ab57
3a132238-a495-485c-a722-4eff1f11940f	\N	\N	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	819870ec-e5e0-496e-9607-f84ce11db329	2	20	t	a961e53a-20cc-499f-8773-a9e18c62aa63	\N
f90d02d1-c82f-43b5-bc9a-500976e44a56	\N	idp-username-password-form	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	35ded041-14f8-4334-98c5-439db8433b96	0	10	f	\N	\N
1c6094f7-48f5-4460-bfcb-1b6f860cb241	\N	\N	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	35ded041-14f8-4334-98c5-439db8433b96	1	20	t	fd87fcb1-225a-40dc-b269-c9432b0c8e2c	\N
911e68a9-753a-4147-abaf-fdbf06e56863	\N	auth-cookie	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	6b950abd-0602-4993-9837-c2a4e0d72f35	2	10	f	\N	\N
f9774271-f15d-4e63-a72f-55fc9e566b95	\N	auth-spnego	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	6b950abd-0602-4993-9837-c2a4e0d72f35	3	20	f	\N	\N
9db4f2cd-c305-4b50-a2d7-fcf59a68babb	\N	identity-provider-redirector	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	6b950abd-0602-4993-9837-c2a4e0d72f35	2	25	f	\N	\N
a440d81f-cd7c-46a6-8257-35fe97edce60	\N	\N	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	6b950abd-0602-4993-9837-c2a4e0d72f35	2	30	t	7235884d-4925-41c4-87dd-c0d61aa5a6c1	\N
abef757f-63be-47e3-8623-0ac7129d95bc	\N	client-secret	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	3fe1323e-b3b4-43a0-b8c8-b084d05b3c39	2	10	f	\N	\N
15e95133-990a-44d9-aeb8-bf13f22b2309	\N	client-jwt	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	3fe1323e-b3b4-43a0-b8c8-b084d05b3c39	2	20	f	\N	\N
c15ea9fa-2307-4285-bf26-f4225f668ffc	\N	client-secret-jwt	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	3fe1323e-b3b4-43a0-b8c8-b084d05b3c39	2	30	f	\N	\N
259fe53e-2d5f-4f04-9213-6d4aad9888e7	\N	client-x509	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	3fe1323e-b3b4-43a0-b8c8-b084d05b3c39	2	40	f	\N	\N
ccec3cf3-5fa7-4fa6-840a-635acc1e322f	\N	direct-grant-validate-username	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	77c83491-af58-412d-97eb-1490ae30a233	0	10	f	\N	\N
9e23cc39-9726-4178-84ae-2a1cfb7dafea	\N	direct-grant-validate-password	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	77c83491-af58-412d-97eb-1490ae30a233	0	20	f	\N	\N
edb9f108-bd21-4bed-96c3-c6993c013304	\N	\N	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	77c83491-af58-412d-97eb-1490ae30a233	1	30	t	1206f2de-2dfc-42dd-b69d-37fc96ef1aae	\N
22d4a3ca-ca0c-49c9-859d-e59a781778f0	\N	docker-http-basic-authenticator	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	4034bbd9-d9b2-4ea7-a860-4da8a1dac0ee	0	10	f	\N	\N
ef939827-e91a-4e02-9beb-2eac9162f2c5	\N	idp-review-profile	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	4cf8e0d3-9efb-4c20-be8d-6b2e4919de8f	0	10	f	\N	5bbba108-38eb-4e9a-b737-3522a8694cbc
b65631e0-768f-49a2-a16a-af552c6b4c93	\N	\N	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	4cf8e0d3-9efb-4c20-be8d-6b2e4919de8f	0	20	t	819870ec-e5e0-496e-9607-f84ce11db329	\N
7301c1df-3c89-4f30-9dd0-205627efd313	\N	auth-username-password-form	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	7235884d-4925-41c4-87dd-c0d61aa5a6c1	0	10	f	\N	\N
06155d85-6197-4687-bf75-df78071ee651	\N	\N	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	7235884d-4925-41c4-87dd-c0d61aa5a6c1	1	20	t	35bfcddc-3ad3-4895-866a-cfd8332011d4	\N
83d83117-fc6f-42f6-9bae-ff2a13f066e1	\N	no-cookie-redirect	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	06352f7a-7faa-4d2e-bef6-fa7861a3f80c	0	10	f	\N	\N
c3cb0316-bd30-4eb3-a88e-a38ff2219115	\N	\N	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	06352f7a-7faa-4d2e-bef6-fa7861a3f80c	0	20	t	0a18975a-4db0-499a-86a4-3eba6b3bb61a	\N
b4ea63e5-3597-411d-b149-7684d36a9f4e	\N	registration-page-form	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	d9619104-b36e-46f2-bc36-92d2cd74fbd4	0	10	t	387688db-0477-4c47-b94b-ad877a478430	\N
c07045ee-626f-42a7-ac67-f9e13a511571	\N	registration-user-creation	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	387688db-0477-4c47-b94b-ad877a478430	0	20	f	\N	\N
e64e2624-4b61-4f1c-af25-dfd54186f274	\N	registration-profile-action	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	387688db-0477-4c47-b94b-ad877a478430	0	40	f	\N	\N
067e99e6-4b9e-4a39-ba7d-6aec046b5e45	\N	registration-password-action	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	387688db-0477-4c47-b94b-ad877a478430	0	50	f	\N	\N
8e5228a5-4587-4445-9853-46d8c6ed5f58	\N	registration-recaptcha-action	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	387688db-0477-4c47-b94b-ad877a478430	3	60	f	\N	\N
590c12c3-5be7-4d32-a3c5-0439bed2fa26	\N	reset-credentials-choose-user	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	9badc312-6bac-4212-a42a-26b329c8d75b	0	10	f	\N	\N
e48c68bc-6afd-4c90-b9b2-fe89b019611f	\N	reset-credential-email	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	9badc312-6bac-4212-a42a-26b329c8d75b	0	20	f	\N	\N
f3afe15b-8a28-4470-8fa7-ad52a22011d0	\N	reset-password	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	9badc312-6bac-4212-a42a-26b329c8d75b	0	30	f	\N	\N
673fabef-9a23-4136-9153-c4ebb51984d6	\N	\N	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	9badc312-6bac-4212-a42a-26b329c8d75b	1	40	t	b073676d-e183-4a02-beab-3e1d48062a49	\N
e5e97bdc-1acb-4349-9406-f8e490818ecc	\N	http-basic-authenticator	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	885c530b-9864-4a4f-b6a5-46a486b6a337	0	10	f	\N	\N
\.


--
-- Data for Name: authentication_flow; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.authentication_flow (id, alias, description, realm_id, provider_id, top_level, built_in) FROM stdin;
fe605ee4-a865-4142-8ad5-2ff12a1816d1	browser	browser based authentication	65e9a13f-13e5-431c-8500-c136a2014a70	basic-flow	t	t
c0fc42a5-a993-4ad0-b49a-84015c06ef43	forms	Username, password, otp and other auth forms.	65e9a13f-13e5-431c-8500-c136a2014a70	basic-flow	f	t
15c58270-85de-4fe9-90fa-100594e19a0f	Browser - Conditional OTP	Flow to determine if the OTP is required for the authentication	65e9a13f-13e5-431c-8500-c136a2014a70	basic-flow	f	t
04e8e7ab-6450-4440-9a6f-6e0edafe5589	direct grant	OpenID Connect Resource Owner Grant	65e9a13f-13e5-431c-8500-c136a2014a70	basic-flow	t	t
b37ff42b-b462-46d7-955e-6fcf0e8d4d99	Direct Grant - Conditional OTP	Flow to determine if the OTP is required for the authentication	65e9a13f-13e5-431c-8500-c136a2014a70	basic-flow	f	t
89e71be5-0fce-4c06-a542-6b6f8952444d	registration	registration flow	65e9a13f-13e5-431c-8500-c136a2014a70	basic-flow	t	t
aecfd1ec-89ad-4cf9-9ebb-84744032537a	registration form	registration form	65e9a13f-13e5-431c-8500-c136a2014a70	form-flow	f	t
3c8babf4-e626-45a8-9fa2-35c503e7a05b	reset credentials	Reset credentials for a user if they forgot their password or something	65e9a13f-13e5-431c-8500-c136a2014a70	basic-flow	t	t
60e2db73-339a-45bb-82c4-96d1434c7296	Reset - Conditional OTP	Flow to determine if the OTP should be reset or not. Set to REQUIRED to force.	65e9a13f-13e5-431c-8500-c136a2014a70	basic-flow	f	t
7bcb46cd-c5c1-4f5b-8333-82449cfa5b13	clients	Base authentication for clients	65e9a13f-13e5-431c-8500-c136a2014a70	client-flow	t	t
c24c9c4c-1943-482f-ab78-0f2594b3b61d	first broker login	Actions taken after first broker login with identity provider account, which is not yet linked to any Keycloak account	65e9a13f-13e5-431c-8500-c136a2014a70	basic-flow	t	t
3c6fa816-b307-44b6-8aed-b8a673e94180	User creation or linking	Flow for the existing/non-existing user alternatives	65e9a13f-13e5-431c-8500-c136a2014a70	basic-flow	f	t
e8a4b1b1-6d5d-4ead-9f1e-6658d872939c	Handle Existing Account	Handle what to do if there is existing account with same email/username like authenticated identity provider	65e9a13f-13e5-431c-8500-c136a2014a70	basic-flow	f	t
768dccfd-6e6d-4efc-a26f-2d35e619ab02	Account verification options	Method with which to verity the existing account	65e9a13f-13e5-431c-8500-c136a2014a70	basic-flow	f	t
2537c4d7-339e-45d3-a75a-d0062ab34e3e	Verify Existing Account by Re-authentication	Reauthentication of existing account	65e9a13f-13e5-431c-8500-c136a2014a70	basic-flow	f	t
efc248bb-a16a-4fea-aba6-24be4a264b86	First broker login - Conditional OTP	Flow to determine if the OTP is required for the authentication	65e9a13f-13e5-431c-8500-c136a2014a70	basic-flow	f	t
3fa9d297-9911-4eb1-9f99-e76ae8ccd132	saml ecp	SAML ECP Profile Authentication Flow	65e9a13f-13e5-431c-8500-c136a2014a70	basic-flow	t	t
9f04ad5f-f308-4f56-82ac-2e96fc0aa0bb	docker auth	Used by Docker clients to authenticate against the IDP	65e9a13f-13e5-431c-8500-c136a2014a70	basic-flow	t	t
d1ab1db5-d2f7-46c3-afaf-6d412c7de78c	http challenge	An authentication flow based on challenge-response HTTP Authentication Schemes	65e9a13f-13e5-431c-8500-c136a2014a70	basic-flow	t	t
f94250d3-72d9-41f8-a80b-95fe80651360	Authentication Options	Authentication options.	65e9a13f-13e5-431c-8500-c136a2014a70	basic-flow	f	t
809cde89-3357-4ccb-8eb6-4134fad6e1e7	Account verification options	Method with which to verity the existing account	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	basic-flow	f	t
0a18975a-4db0-499a-86a4-3eba6b3bb61a	Authentication Options	Authentication options.	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	basic-flow	f	t
35bfcddc-3ad3-4895-866a-cfd8332011d4	Browser - Conditional OTP	Flow to determine if the OTP is required for the authentication	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	basic-flow	f	t
1206f2de-2dfc-42dd-b69d-37fc96ef1aae	Direct Grant - Conditional OTP	Flow to determine if the OTP is required for the authentication	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	basic-flow	f	t
fd87fcb1-225a-40dc-b269-c9432b0c8e2c	First broker login - Conditional OTP	Flow to determine if the OTP is required for the authentication	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	basic-flow	f	t
a961e53a-20cc-499f-8773-a9e18c62aa63	Handle Existing Account	Handle what to do if there is existing account with same email/username like authenticated identity provider	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	basic-flow	f	t
b073676d-e183-4a02-beab-3e1d48062a49	Reset - Conditional OTP	Flow to determine if the OTP should be reset or not. Set to REQUIRED to force.	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	basic-flow	f	t
819870ec-e5e0-496e-9607-f84ce11db329	User creation or linking	Flow for the existing/non-existing user alternatives	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	basic-flow	f	t
35ded041-14f8-4334-98c5-439db8433b96	Verify Existing Account by Re-authentication	Reauthentication of existing account	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	basic-flow	f	t
6b950abd-0602-4993-9837-c2a4e0d72f35	browser	browser based authentication	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	basic-flow	t	t
3fe1323e-b3b4-43a0-b8c8-b084d05b3c39	clients	Base authentication for clients	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	client-flow	t	t
77c83491-af58-412d-97eb-1490ae30a233	direct grant	OpenID Connect Resource Owner Grant	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	basic-flow	t	t
4034bbd9-d9b2-4ea7-a860-4da8a1dac0ee	docker auth	Used by Docker clients to authenticate against the IDP	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	basic-flow	t	t
4cf8e0d3-9efb-4c20-be8d-6b2e4919de8f	first broker login	Actions taken after first broker login with identity provider account, which is not yet linked to any Keycloak account	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	basic-flow	t	t
7235884d-4925-41c4-87dd-c0d61aa5a6c1	forms	Username, password, otp and other auth forms.	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	basic-flow	f	t
06352f7a-7faa-4d2e-bef6-fa7861a3f80c	http challenge	An authentication flow based on challenge-response HTTP Authentication Schemes	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	basic-flow	t	t
d9619104-b36e-46f2-bc36-92d2cd74fbd4	registration	registration flow	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	basic-flow	t	t
387688db-0477-4c47-b94b-ad877a478430	registration form	registration form	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	form-flow	f	t
9badc312-6bac-4212-a42a-26b329c8d75b	reset credentials	Reset credentials for a user if they forgot their password or something	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	basic-flow	t	t
885c530b-9864-4a4f-b6a5-46a486b6a337	saml ecp	SAML ECP Profile Authentication Flow	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	basic-flow	t	t
\.


--
-- Data for Name: authenticator_config; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.authenticator_config (id, alias, realm_id) FROM stdin;
daa67f59-66dc-426e-9401-d808b42e7dd7	review profile config	65e9a13f-13e5-431c-8500-c136a2014a70
73c5fb45-df04-47da-947e-55ad15cde85a	create unique user config	65e9a13f-13e5-431c-8500-c136a2014a70
6cb685bc-eec3-48eb-995a-dcea1a47ab57	create unique user config	8ce1928e-b671-44b2-ab2f-ba0a2fc46762
5bbba108-38eb-4e9a-b737-3522a8694cbc	review profile config	8ce1928e-b671-44b2-ab2f-ba0a2fc46762
\.


--
-- Data for Name: authenticator_config_entry; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.authenticator_config_entry (authenticator_id, value, name) FROM stdin;
73c5fb45-df04-47da-947e-55ad15cde85a	false	require.password.update.after.registration
daa67f59-66dc-426e-9401-d808b42e7dd7	missing	update.profile.on.first.login
5bbba108-38eb-4e9a-b737-3522a8694cbc	missing	update.profile.on.first.login
6cb685bc-eec3-48eb-995a-dcea1a47ab57	false	require.password.update.after.registration
\.


--
-- Data for Name: broker_link; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.broker_link (identity_provider, storage_provider_id, realm_id, broker_user_id, broker_username, token, user_id) FROM stdin;
\.


--
-- Data for Name: client; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.client (id, enabled, full_scope_allowed, client_id, not_before, public_client, secret, base_url, bearer_only, management_url, surrogate_auth_required, realm_id, protocol, node_rereg_timeout, frontchannel_logout, consent_required, name, service_accounts_enabled, client_authenticator_type, root_url, description, registration_token, standard_flow_enabled, implicit_flow_enabled, direct_access_grants_enabled, always_display_in_console) FROM stdin;
852e20a2-bc82-4a22-bd43-3d09702452fa	t	f	master-realm	0	f	\N	\N	t	\N	f	65e9a13f-13e5-431c-8500-c136a2014a70	\N	0	f	f	master Realm	f	client-secret	\N	\N	\N	t	f	f	f
e549e79e-4e77-425f-8611-8eefc4f267da	t	f	account	0	t	\N	/realms/master/account/	f	\N	f	65e9a13f-13e5-431c-8500-c136a2014a70	openid-connect	0	f	f		f	client-secret		\N	\N	t	f	f	f
3fb776f9-9b41-4997-b3b8-cff334bc72fc	t	f	account-console	0	t	\N	/realms/master/account/	f	\N	f	65e9a13f-13e5-431c-8500-c136a2014a70	openid-connect	0	f	f	console	f	client-secret		\N	\N	t	f	f	f
26393c65-dd94-4211-8bfa-ad080c4a2726	t	f	broker	0	f	\N	\N	t	\N	f	65e9a13f-13e5-431c-8500-c136a2014a70	openid-connect	0	f	f		f	client-secret	\N	\N	\N	t	f	f	f
e6857f1f-a8d7-4fe0-bdf8-b7dd7685d50f	t	f	security-admin-console	0	t	\N	/admin/master/console/	f	\N	f	65e9a13f-13e5-431c-8500-c136a2014a70	openid-connect	0	f	f	admin-console	f	client-secret		\N	\N	t	f	f	f
c7766ac6-9664-4577-a7ac-cf83c8901a93	t	f	admin-cli	0	t	\N	\N	f	\N	f	65e9a13f-13e5-431c-8500-c136a2014a70	openid-connect	0	f	f	cli	f	client-secret	\N	\N	\N	f	f	t	f
7c83487d-a523-408e-ad85-666f44f21031	t	f	hocus-realm	0	f	\N	\N	t	\N	f	65e9a13f-13e5-431c-8500-c136a2014a70	\N	0	f	f	hocus Realm	f	client-secret	\N	\N	\N	t	f	f	f
fecc6bc0-e452-4102-8c7c-f8364d65a61a	t	f	account	0	t	\N	/realms/hocus/account/	f	\N	f	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	openid-connect	0	f	f		f	client-secret		\N	\N	t	f	f	f
dfc79924-01ec-4507-9647-1964c2fc427a	t	f	admin-cli	0	t	\N	\N	f	\N	f	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	openid-connect	0	f	f	cli	f	client-secret	\N	\N	\N	f	f	t	f
7e7a1ccd-b003-4ed9-91f7-13fb6e2eb2d6	t	f	broker	0	f	\N	\N	t	\N	f	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	openid-connect	0	f	f		f	client-secret	\N	\N	\N	t	f	f	f
024e7161-fb12-44a1-bc21-b2d03e26d3ee	t	f	security-admin-console	0	t	\N	/admin/hocus/console/	f	\N	f	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	openid-connect	0	f	f	admin-console	f	client-secret		\N	\N	t	f	f	f
ad5a10c6-c1c6-4f54-8b86-c0ffa7df772c	t	f	realm-management	0	f	\N	\N	f	\N	f	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	openid-connect	0	f	f	management	t	client-secret	\N	\N	\N	t	f	f	f
a16f9d56-89da-4707-8e7b-8e351372e3d3	t	f	account-console	0	t	\N	/realms/hocus/account/	f	\N	f	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	openid-connect	0	f	f	console	f	client-secret		\N	\N	t	f	f	f
ade0aace-88fa-4e18-90ae-a7d816a349e6	t	t	hocus	0	f	**********		f		f	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	openid-connect	-1	t	f		f	client-secret			\N	t	t	t	f
\.


--
-- Data for Name: client_attributes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.client_attributes (client_id, value, name) FROM stdin;
e549e79e-4e77-425f-8611-8eefc4f267da	+	post.logout.redirect.uris
3fb776f9-9b41-4997-b3b8-cff334bc72fc	+	post.logout.redirect.uris
3fb776f9-9b41-4997-b3b8-cff334bc72fc	S256	pkce.code.challenge.method
e6857f1f-a8d7-4fe0-bdf8-b7dd7685d50f	+	post.logout.redirect.uris
e6857f1f-a8d7-4fe0-bdf8-b7dd7685d50f	S256	pkce.code.challenge.method
fecc6bc0-e452-4102-8c7c-f8364d65a61a	+	post.logout.redirect.uris
dfc79924-01ec-4507-9647-1964c2fc427a	+	post.logout.redirect.uris
7e7a1ccd-b003-4ed9-91f7-13fb6e2eb2d6	+	post.logout.redirect.uris
ad5a10c6-c1c6-4f54-8b86-c0ffa7df772c	+	post.logout.redirect.uris
024e7161-fb12-44a1-bc21-b2d03e26d3ee	+	post.logout.redirect.uris
024e7161-fb12-44a1-bc21-b2d03e26d3ee	S256	pkce.code.challenge.method
a16f9d56-89da-4707-8e7b-8e351372e3d3	+	post.logout.redirect.uris
a16f9d56-89da-4707-8e7b-8e351372e3d3	S256	pkce.code.challenge.method
ade0aace-88fa-4e18-90ae-a7d816a349e6	1664023100	client.secret.creation.time
ade0aace-88fa-4e18-90ae-a7d816a349e6	http://localhost:3000/	post.logout.redirect.uris
ade0aace-88fa-4e18-90ae-a7d816a349e6	false	oauth2.device.authorization.grant.enabled
ade0aace-88fa-4e18-90ae-a7d816a349e6	false	use.jwks.url
ade0aace-88fa-4e18-90ae-a7d816a349e6	false	backchannel.logout.revoke.offline.tokens
ade0aace-88fa-4e18-90ae-a7d816a349e6	true	use.refresh.tokens
ade0aace-88fa-4e18-90ae-a7d816a349e6	false	tls-client-certificate-bound-access-tokens
ade0aace-88fa-4e18-90ae-a7d816a349e6	false	oidc.ciba.grant.enabled
ade0aace-88fa-4e18-90ae-a7d816a349e6	true	backchannel.logout.session.required
ade0aace-88fa-4e18-90ae-a7d816a349e6	false	client_credentials.use_refresh_token
ade0aace-88fa-4e18-90ae-a7d816a349e6	{}	acr.loa.map
ade0aace-88fa-4e18-90ae-a7d816a349e6	false	require.pushed.authorization.requests
ade0aace-88fa-4e18-90ae-a7d816a349e6	false	display.on.consent.screen
ade0aace-88fa-4e18-90ae-a7d816a349e6	false	token.response.type.bearer.lower-case
\.


--
-- Data for Name: client_auth_flow_bindings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.client_auth_flow_bindings (client_id, flow_id, binding_name) FROM stdin;
\.


--
-- Data for Name: client_initial_access; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.client_initial_access (id, realm_id, "timestamp", expiration, count, remaining_count) FROM stdin;
\.


--
-- Data for Name: client_node_registrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.client_node_registrations (client_id, value, name) FROM stdin;
\.


--
-- Data for Name: client_scope; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.client_scope (id, name, realm_id, description, protocol) FROM stdin;
acf0a738-9931-42c4-9b1d-9e79bf5d0542	offline_access	65e9a13f-13e5-431c-8500-c136a2014a70	OpenID Connect built-in scope: offline_access	openid-connect
4a2871f7-b05b-45c3-b4e3-9d66c7f1c456	role_list	65e9a13f-13e5-431c-8500-c136a2014a70	SAML role list	saml
1670ffaf-0dcc-43ab-9542-20a5d061cb70	profile	65e9a13f-13e5-431c-8500-c136a2014a70	OpenID Connect built-in scope: profile	openid-connect
8c633ac3-01a1-4768-bf94-09d6a8eefe67	email	65e9a13f-13e5-431c-8500-c136a2014a70	OpenID Connect built-in scope: email	openid-connect
8b652e2f-5418-4389-b295-db3f2db7c238	address	65e9a13f-13e5-431c-8500-c136a2014a70	OpenID Connect built-in scope: address	openid-connect
47680830-c71d-4277-aa35-bd6e499b1777	phone	65e9a13f-13e5-431c-8500-c136a2014a70	OpenID Connect built-in scope: phone	openid-connect
919a49fc-a46a-4cc4-a055-db381f8f45ab	roles	65e9a13f-13e5-431c-8500-c136a2014a70	OpenID Connect scope for add user roles to the access token	openid-connect
75f5e8eb-66b0-4e97-b477-c819eb979d33	web-origins	65e9a13f-13e5-431c-8500-c136a2014a70	OpenID Connect scope for add allowed web origins to the access token	openid-connect
73f8f09a-a679-4444-9927-bf122c9ba39d	microprofile-jwt	65e9a13f-13e5-431c-8500-c136a2014a70	Microprofile - JWT built-in scope	openid-connect
28466805-58b3-44ac-a00e-3b67deb134bd	acr	65e9a13f-13e5-431c-8500-c136a2014a70	OpenID Connect scope for add acr (authentication context class reference) to the token	openid-connect
f9307808-d664-47b2-8c29-907b86184053	email	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	OpenID Connect built-in scope: email	openid-connect
8761fac6-8355-47c7-9db0-a09805dbf0d5	microprofile-jwt	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	Microprofile - JWT built-in scope	openid-connect
1539e1f7-ffa4-4dc7-9c8b-b19d76234078	acr	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	OpenID Connect scope for add acr (authentication context class reference) to the token	openid-connect
3752181d-a7af-48a4-bd1d-cd5690f3998c	phone	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	OpenID Connect built-in scope: phone	openid-connect
aeeaa569-8888-4607-a030-c9f979c44f61	role_list	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	SAML role list	saml
10e311ca-7b29-4122-b23a-ee3854f11c8a	offline_access	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	OpenID Connect built-in scope: offline_access	openid-connect
56b9fbab-32f2-44a5-8554-7d5c116dbbde	profile	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	OpenID Connect built-in scope: profile	openid-connect
fc51ff5e-3f5c-440e-9709-2e51bbd7610d	address	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	OpenID Connect built-in scope: address	openid-connect
60b6f750-8b18-4e73-81e4-47df8d247e71	roles	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	OpenID Connect scope for add user roles to the access token	openid-connect
376c7112-f871-403d-930f-4cc72d34a411	web-origins	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	OpenID Connect scope for add allowed web origins to the access token	openid-connect
\.


--
-- Data for Name: client_scope_attributes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.client_scope_attributes (scope_id, value, name) FROM stdin;
acf0a738-9931-42c4-9b1d-9e79bf5d0542	true	display.on.consent.screen
acf0a738-9931-42c4-9b1d-9e79bf5d0542		consent.screen.text
4a2871f7-b05b-45c3-b4e3-9d66c7f1c456	true	display.on.consent.screen
4a2871f7-b05b-45c3-b4e3-9d66c7f1c456		consent.screen.text
1670ffaf-0dcc-43ab-9542-20a5d061cb70	true	display.on.consent.screen
1670ffaf-0dcc-43ab-9542-20a5d061cb70		consent.screen.text
1670ffaf-0dcc-43ab-9542-20a5d061cb70	true	include.in.token.scope
8c633ac3-01a1-4768-bf94-09d6a8eefe67	true	display.on.consent.screen
8c633ac3-01a1-4768-bf94-09d6a8eefe67		consent.screen.text
8c633ac3-01a1-4768-bf94-09d6a8eefe67	true	include.in.token.scope
8b652e2f-5418-4389-b295-db3f2db7c238	true	display.on.consent.screen
8b652e2f-5418-4389-b295-db3f2db7c238		consent.screen.text
8b652e2f-5418-4389-b295-db3f2db7c238	true	include.in.token.scope
47680830-c71d-4277-aa35-bd6e499b1777	true	display.on.consent.screen
47680830-c71d-4277-aa35-bd6e499b1777		consent.screen.text
47680830-c71d-4277-aa35-bd6e499b1777	true	include.in.token.scope
919a49fc-a46a-4cc4-a055-db381f8f45ab	true	display.on.consent.screen
919a49fc-a46a-4cc4-a055-db381f8f45ab		consent.screen.text
919a49fc-a46a-4cc4-a055-db381f8f45ab	false	include.in.token.scope
75f5e8eb-66b0-4e97-b477-c819eb979d33	false	display.on.consent.screen
75f5e8eb-66b0-4e97-b477-c819eb979d33		consent.screen.text
75f5e8eb-66b0-4e97-b477-c819eb979d33	false	include.in.token.scope
73f8f09a-a679-4444-9927-bf122c9ba39d	false	display.on.consent.screen
73f8f09a-a679-4444-9927-bf122c9ba39d	true	include.in.token.scope
28466805-58b3-44ac-a00e-3b67deb134bd	false	display.on.consent.screen
28466805-58b3-44ac-a00e-3b67deb134bd	false	include.in.token.scope
f9307808-d664-47b2-8c29-907b86184053	true	include.in.token.scope
f9307808-d664-47b2-8c29-907b86184053	true	display.on.consent.screen
f9307808-d664-47b2-8c29-907b86184053		consent.screen.text
8761fac6-8355-47c7-9db0-a09805dbf0d5	true	include.in.token.scope
8761fac6-8355-47c7-9db0-a09805dbf0d5	false	display.on.consent.screen
1539e1f7-ffa4-4dc7-9c8b-b19d76234078	false	include.in.token.scope
1539e1f7-ffa4-4dc7-9c8b-b19d76234078	false	display.on.consent.screen
3752181d-a7af-48a4-bd1d-cd5690f3998c	true	include.in.token.scope
3752181d-a7af-48a4-bd1d-cd5690f3998c	true	display.on.consent.screen
3752181d-a7af-48a4-bd1d-cd5690f3998c		consent.screen.text
aeeaa569-8888-4607-a030-c9f979c44f61		consent.screen.text
aeeaa569-8888-4607-a030-c9f979c44f61	true	display.on.consent.screen
10e311ca-7b29-4122-b23a-ee3854f11c8a		consent.screen.text
10e311ca-7b29-4122-b23a-ee3854f11c8a	true	display.on.consent.screen
56b9fbab-32f2-44a5-8554-7d5c116dbbde	true	include.in.token.scope
56b9fbab-32f2-44a5-8554-7d5c116dbbde	true	display.on.consent.screen
56b9fbab-32f2-44a5-8554-7d5c116dbbde		consent.screen.text
fc51ff5e-3f5c-440e-9709-2e51bbd7610d	true	include.in.token.scope
fc51ff5e-3f5c-440e-9709-2e51bbd7610d	true	display.on.consent.screen
fc51ff5e-3f5c-440e-9709-2e51bbd7610d		consent.screen.text
60b6f750-8b18-4e73-81e4-47df8d247e71	false	include.in.token.scope
60b6f750-8b18-4e73-81e4-47df8d247e71	true	display.on.consent.screen
60b6f750-8b18-4e73-81e4-47df8d247e71		consent.screen.text
376c7112-f871-403d-930f-4cc72d34a411	false	include.in.token.scope
376c7112-f871-403d-930f-4cc72d34a411	false	display.on.consent.screen
376c7112-f871-403d-930f-4cc72d34a411		consent.screen.text
\.


--
-- Data for Name: client_scope_client; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.client_scope_client (client_id, scope_id, default_scope) FROM stdin;
e549e79e-4e77-425f-8611-8eefc4f267da	1670ffaf-0dcc-43ab-9542-20a5d061cb70	t
e549e79e-4e77-425f-8611-8eefc4f267da	8c633ac3-01a1-4768-bf94-09d6a8eefe67	t
e549e79e-4e77-425f-8611-8eefc4f267da	28466805-58b3-44ac-a00e-3b67deb134bd	t
e549e79e-4e77-425f-8611-8eefc4f267da	75f5e8eb-66b0-4e97-b477-c819eb979d33	t
e549e79e-4e77-425f-8611-8eefc4f267da	919a49fc-a46a-4cc4-a055-db381f8f45ab	t
e549e79e-4e77-425f-8611-8eefc4f267da	47680830-c71d-4277-aa35-bd6e499b1777	f
e549e79e-4e77-425f-8611-8eefc4f267da	acf0a738-9931-42c4-9b1d-9e79bf5d0542	f
e549e79e-4e77-425f-8611-8eefc4f267da	73f8f09a-a679-4444-9927-bf122c9ba39d	f
e549e79e-4e77-425f-8611-8eefc4f267da	8b652e2f-5418-4389-b295-db3f2db7c238	f
3fb776f9-9b41-4997-b3b8-cff334bc72fc	1670ffaf-0dcc-43ab-9542-20a5d061cb70	t
3fb776f9-9b41-4997-b3b8-cff334bc72fc	8c633ac3-01a1-4768-bf94-09d6a8eefe67	t
3fb776f9-9b41-4997-b3b8-cff334bc72fc	28466805-58b3-44ac-a00e-3b67deb134bd	t
3fb776f9-9b41-4997-b3b8-cff334bc72fc	75f5e8eb-66b0-4e97-b477-c819eb979d33	t
3fb776f9-9b41-4997-b3b8-cff334bc72fc	919a49fc-a46a-4cc4-a055-db381f8f45ab	t
3fb776f9-9b41-4997-b3b8-cff334bc72fc	47680830-c71d-4277-aa35-bd6e499b1777	f
3fb776f9-9b41-4997-b3b8-cff334bc72fc	acf0a738-9931-42c4-9b1d-9e79bf5d0542	f
3fb776f9-9b41-4997-b3b8-cff334bc72fc	73f8f09a-a679-4444-9927-bf122c9ba39d	f
3fb776f9-9b41-4997-b3b8-cff334bc72fc	8b652e2f-5418-4389-b295-db3f2db7c238	f
c7766ac6-9664-4577-a7ac-cf83c8901a93	1670ffaf-0dcc-43ab-9542-20a5d061cb70	t
c7766ac6-9664-4577-a7ac-cf83c8901a93	8c633ac3-01a1-4768-bf94-09d6a8eefe67	t
c7766ac6-9664-4577-a7ac-cf83c8901a93	28466805-58b3-44ac-a00e-3b67deb134bd	t
c7766ac6-9664-4577-a7ac-cf83c8901a93	75f5e8eb-66b0-4e97-b477-c819eb979d33	t
c7766ac6-9664-4577-a7ac-cf83c8901a93	919a49fc-a46a-4cc4-a055-db381f8f45ab	t
c7766ac6-9664-4577-a7ac-cf83c8901a93	47680830-c71d-4277-aa35-bd6e499b1777	f
c7766ac6-9664-4577-a7ac-cf83c8901a93	acf0a738-9931-42c4-9b1d-9e79bf5d0542	f
c7766ac6-9664-4577-a7ac-cf83c8901a93	73f8f09a-a679-4444-9927-bf122c9ba39d	f
c7766ac6-9664-4577-a7ac-cf83c8901a93	8b652e2f-5418-4389-b295-db3f2db7c238	f
26393c65-dd94-4211-8bfa-ad080c4a2726	1670ffaf-0dcc-43ab-9542-20a5d061cb70	t
26393c65-dd94-4211-8bfa-ad080c4a2726	8c633ac3-01a1-4768-bf94-09d6a8eefe67	t
26393c65-dd94-4211-8bfa-ad080c4a2726	28466805-58b3-44ac-a00e-3b67deb134bd	t
26393c65-dd94-4211-8bfa-ad080c4a2726	75f5e8eb-66b0-4e97-b477-c819eb979d33	t
26393c65-dd94-4211-8bfa-ad080c4a2726	919a49fc-a46a-4cc4-a055-db381f8f45ab	t
26393c65-dd94-4211-8bfa-ad080c4a2726	47680830-c71d-4277-aa35-bd6e499b1777	f
26393c65-dd94-4211-8bfa-ad080c4a2726	acf0a738-9931-42c4-9b1d-9e79bf5d0542	f
26393c65-dd94-4211-8bfa-ad080c4a2726	73f8f09a-a679-4444-9927-bf122c9ba39d	f
26393c65-dd94-4211-8bfa-ad080c4a2726	8b652e2f-5418-4389-b295-db3f2db7c238	f
852e20a2-bc82-4a22-bd43-3d09702452fa	1670ffaf-0dcc-43ab-9542-20a5d061cb70	t
852e20a2-bc82-4a22-bd43-3d09702452fa	8c633ac3-01a1-4768-bf94-09d6a8eefe67	t
852e20a2-bc82-4a22-bd43-3d09702452fa	28466805-58b3-44ac-a00e-3b67deb134bd	t
852e20a2-bc82-4a22-bd43-3d09702452fa	75f5e8eb-66b0-4e97-b477-c819eb979d33	t
852e20a2-bc82-4a22-bd43-3d09702452fa	919a49fc-a46a-4cc4-a055-db381f8f45ab	t
852e20a2-bc82-4a22-bd43-3d09702452fa	47680830-c71d-4277-aa35-bd6e499b1777	f
852e20a2-bc82-4a22-bd43-3d09702452fa	acf0a738-9931-42c4-9b1d-9e79bf5d0542	f
852e20a2-bc82-4a22-bd43-3d09702452fa	73f8f09a-a679-4444-9927-bf122c9ba39d	f
852e20a2-bc82-4a22-bd43-3d09702452fa	8b652e2f-5418-4389-b295-db3f2db7c238	f
e6857f1f-a8d7-4fe0-bdf8-b7dd7685d50f	1670ffaf-0dcc-43ab-9542-20a5d061cb70	t
e6857f1f-a8d7-4fe0-bdf8-b7dd7685d50f	8c633ac3-01a1-4768-bf94-09d6a8eefe67	t
e6857f1f-a8d7-4fe0-bdf8-b7dd7685d50f	28466805-58b3-44ac-a00e-3b67deb134bd	t
e6857f1f-a8d7-4fe0-bdf8-b7dd7685d50f	75f5e8eb-66b0-4e97-b477-c819eb979d33	t
e6857f1f-a8d7-4fe0-bdf8-b7dd7685d50f	919a49fc-a46a-4cc4-a055-db381f8f45ab	t
e6857f1f-a8d7-4fe0-bdf8-b7dd7685d50f	47680830-c71d-4277-aa35-bd6e499b1777	f
e6857f1f-a8d7-4fe0-bdf8-b7dd7685d50f	acf0a738-9931-42c4-9b1d-9e79bf5d0542	f
e6857f1f-a8d7-4fe0-bdf8-b7dd7685d50f	73f8f09a-a679-4444-9927-bf122c9ba39d	f
e6857f1f-a8d7-4fe0-bdf8-b7dd7685d50f	8b652e2f-5418-4389-b295-db3f2db7c238	f
fecc6bc0-e452-4102-8c7c-f8364d65a61a	376c7112-f871-403d-930f-4cc72d34a411	t
fecc6bc0-e452-4102-8c7c-f8364d65a61a	1539e1f7-ffa4-4dc7-9c8b-b19d76234078	t
fecc6bc0-e452-4102-8c7c-f8364d65a61a	56b9fbab-32f2-44a5-8554-7d5c116dbbde	t
fecc6bc0-e452-4102-8c7c-f8364d65a61a	60b6f750-8b18-4e73-81e4-47df8d247e71	t
fecc6bc0-e452-4102-8c7c-f8364d65a61a	f9307808-d664-47b2-8c29-907b86184053	t
fecc6bc0-e452-4102-8c7c-f8364d65a61a	fc51ff5e-3f5c-440e-9709-2e51bbd7610d	f
fecc6bc0-e452-4102-8c7c-f8364d65a61a	3752181d-a7af-48a4-bd1d-cd5690f3998c	f
fecc6bc0-e452-4102-8c7c-f8364d65a61a	10e311ca-7b29-4122-b23a-ee3854f11c8a	f
fecc6bc0-e452-4102-8c7c-f8364d65a61a	8761fac6-8355-47c7-9db0-a09805dbf0d5	f
dfc79924-01ec-4507-9647-1964c2fc427a	376c7112-f871-403d-930f-4cc72d34a411	t
dfc79924-01ec-4507-9647-1964c2fc427a	1539e1f7-ffa4-4dc7-9c8b-b19d76234078	t
dfc79924-01ec-4507-9647-1964c2fc427a	56b9fbab-32f2-44a5-8554-7d5c116dbbde	t
dfc79924-01ec-4507-9647-1964c2fc427a	60b6f750-8b18-4e73-81e4-47df8d247e71	t
dfc79924-01ec-4507-9647-1964c2fc427a	f9307808-d664-47b2-8c29-907b86184053	t
dfc79924-01ec-4507-9647-1964c2fc427a	fc51ff5e-3f5c-440e-9709-2e51bbd7610d	f
dfc79924-01ec-4507-9647-1964c2fc427a	3752181d-a7af-48a4-bd1d-cd5690f3998c	f
dfc79924-01ec-4507-9647-1964c2fc427a	10e311ca-7b29-4122-b23a-ee3854f11c8a	f
dfc79924-01ec-4507-9647-1964c2fc427a	8761fac6-8355-47c7-9db0-a09805dbf0d5	f
7e7a1ccd-b003-4ed9-91f7-13fb6e2eb2d6	376c7112-f871-403d-930f-4cc72d34a411	t
7e7a1ccd-b003-4ed9-91f7-13fb6e2eb2d6	1539e1f7-ffa4-4dc7-9c8b-b19d76234078	t
7e7a1ccd-b003-4ed9-91f7-13fb6e2eb2d6	56b9fbab-32f2-44a5-8554-7d5c116dbbde	t
7e7a1ccd-b003-4ed9-91f7-13fb6e2eb2d6	60b6f750-8b18-4e73-81e4-47df8d247e71	t
7e7a1ccd-b003-4ed9-91f7-13fb6e2eb2d6	f9307808-d664-47b2-8c29-907b86184053	t
7e7a1ccd-b003-4ed9-91f7-13fb6e2eb2d6	fc51ff5e-3f5c-440e-9709-2e51bbd7610d	f
7e7a1ccd-b003-4ed9-91f7-13fb6e2eb2d6	3752181d-a7af-48a4-bd1d-cd5690f3998c	f
7e7a1ccd-b003-4ed9-91f7-13fb6e2eb2d6	10e311ca-7b29-4122-b23a-ee3854f11c8a	f
7e7a1ccd-b003-4ed9-91f7-13fb6e2eb2d6	8761fac6-8355-47c7-9db0-a09805dbf0d5	f
ad5a10c6-c1c6-4f54-8b86-c0ffa7df772c	376c7112-f871-403d-930f-4cc72d34a411	t
ad5a10c6-c1c6-4f54-8b86-c0ffa7df772c	1539e1f7-ffa4-4dc7-9c8b-b19d76234078	t
ad5a10c6-c1c6-4f54-8b86-c0ffa7df772c	56b9fbab-32f2-44a5-8554-7d5c116dbbde	t
ad5a10c6-c1c6-4f54-8b86-c0ffa7df772c	60b6f750-8b18-4e73-81e4-47df8d247e71	t
ad5a10c6-c1c6-4f54-8b86-c0ffa7df772c	f9307808-d664-47b2-8c29-907b86184053	t
ad5a10c6-c1c6-4f54-8b86-c0ffa7df772c	fc51ff5e-3f5c-440e-9709-2e51bbd7610d	f
ad5a10c6-c1c6-4f54-8b86-c0ffa7df772c	3752181d-a7af-48a4-bd1d-cd5690f3998c	f
ad5a10c6-c1c6-4f54-8b86-c0ffa7df772c	10e311ca-7b29-4122-b23a-ee3854f11c8a	f
ad5a10c6-c1c6-4f54-8b86-c0ffa7df772c	8761fac6-8355-47c7-9db0-a09805dbf0d5	f
024e7161-fb12-44a1-bc21-b2d03e26d3ee	376c7112-f871-403d-930f-4cc72d34a411	t
024e7161-fb12-44a1-bc21-b2d03e26d3ee	1539e1f7-ffa4-4dc7-9c8b-b19d76234078	t
024e7161-fb12-44a1-bc21-b2d03e26d3ee	56b9fbab-32f2-44a5-8554-7d5c116dbbde	t
024e7161-fb12-44a1-bc21-b2d03e26d3ee	60b6f750-8b18-4e73-81e4-47df8d247e71	t
024e7161-fb12-44a1-bc21-b2d03e26d3ee	f9307808-d664-47b2-8c29-907b86184053	t
024e7161-fb12-44a1-bc21-b2d03e26d3ee	fc51ff5e-3f5c-440e-9709-2e51bbd7610d	f
024e7161-fb12-44a1-bc21-b2d03e26d3ee	3752181d-a7af-48a4-bd1d-cd5690f3998c	f
024e7161-fb12-44a1-bc21-b2d03e26d3ee	10e311ca-7b29-4122-b23a-ee3854f11c8a	f
024e7161-fb12-44a1-bc21-b2d03e26d3ee	8761fac6-8355-47c7-9db0-a09805dbf0d5	f
a16f9d56-89da-4707-8e7b-8e351372e3d3	376c7112-f871-403d-930f-4cc72d34a411	t
a16f9d56-89da-4707-8e7b-8e351372e3d3	1539e1f7-ffa4-4dc7-9c8b-b19d76234078	t
a16f9d56-89da-4707-8e7b-8e351372e3d3	56b9fbab-32f2-44a5-8554-7d5c116dbbde	t
a16f9d56-89da-4707-8e7b-8e351372e3d3	60b6f750-8b18-4e73-81e4-47df8d247e71	t
a16f9d56-89da-4707-8e7b-8e351372e3d3	f9307808-d664-47b2-8c29-907b86184053	t
a16f9d56-89da-4707-8e7b-8e351372e3d3	fc51ff5e-3f5c-440e-9709-2e51bbd7610d	f
a16f9d56-89da-4707-8e7b-8e351372e3d3	3752181d-a7af-48a4-bd1d-cd5690f3998c	f
a16f9d56-89da-4707-8e7b-8e351372e3d3	10e311ca-7b29-4122-b23a-ee3854f11c8a	f
a16f9d56-89da-4707-8e7b-8e351372e3d3	8761fac6-8355-47c7-9db0-a09805dbf0d5	f
ade0aace-88fa-4e18-90ae-a7d816a349e6	376c7112-f871-403d-930f-4cc72d34a411	t
ade0aace-88fa-4e18-90ae-a7d816a349e6	1539e1f7-ffa4-4dc7-9c8b-b19d76234078	t
ade0aace-88fa-4e18-90ae-a7d816a349e6	56b9fbab-32f2-44a5-8554-7d5c116dbbde	t
ade0aace-88fa-4e18-90ae-a7d816a349e6	60b6f750-8b18-4e73-81e4-47df8d247e71	t
ade0aace-88fa-4e18-90ae-a7d816a349e6	f9307808-d664-47b2-8c29-907b86184053	t
ade0aace-88fa-4e18-90ae-a7d816a349e6	fc51ff5e-3f5c-440e-9709-2e51bbd7610d	f
ade0aace-88fa-4e18-90ae-a7d816a349e6	3752181d-a7af-48a4-bd1d-cd5690f3998c	f
ade0aace-88fa-4e18-90ae-a7d816a349e6	10e311ca-7b29-4122-b23a-ee3854f11c8a	f
ade0aace-88fa-4e18-90ae-a7d816a349e6	8761fac6-8355-47c7-9db0-a09805dbf0d5	f
\.


--
-- Data for Name: client_scope_role_mapping; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.client_scope_role_mapping (scope_id, role_id) FROM stdin;
acf0a738-9931-42c4-9b1d-9e79bf5d0542	46d240ee-9839-4dc4-b1ff-fdc1d067ce70
10e311ca-7b29-4122-b23a-ee3854f11c8a	feff0cce-4e03-43e6-96c6-decd66171a38
\.


--
-- Data for Name: client_session; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.client_session (id, client_id, redirect_uri, state, "timestamp", session_id, auth_method, realm_id, auth_user_id, current_action) FROM stdin;
\.


--
-- Data for Name: client_session_auth_status; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.client_session_auth_status (authenticator, status, client_session) FROM stdin;
\.


--
-- Data for Name: client_session_note; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.client_session_note (name, value, client_session) FROM stdin;
\.


--
-- Data for Name: client_session_prot_mapper; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.client_session_prot_mapper (protocol_mapper_id, client_session) FROM stdin;
\.


--
-- Data for Name: client_session_role; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.client_session_role (role_id, client_session) FROM stdin;
\.


--
-- Data for Name: client_user_session_note; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.client_user_session_note (name, value, client_session) FROM stdin;
\.


--
-- Data for Name: component; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.component (id, name, parent_id, provider_id, provider_type, realm_id, sub_type) FROM stdin;
f68b513b-b6d2-445d-a12b-3a1549b8bfad	Trusted Hosts	65e9a13f-13e5-431c-8500-c136a2014a70	trusted-hosts	org.keycloak.services.clientregistration.policy.ClientRegistrationPolicy	65e9a13f-13e5-431c-8500-c136a2014a70	anonymous
459f8cec-8cd4-460d-9e5b-4992885e3e85	Consent Required	65e9a13f-13e5-431c-8500-c136a2014a70	consent-required	org.keycloak.services.clientregistration.policy.ClientRegistrationPolicy	65e9a13f-13e5-431c-8500-c136a2014a70	anonymous
9a50aa31-34a9-487f-b233-423516c02e94	Full Scope Disabled	65e9a13f-13e5-431c-8500-c136a2014a70	scope	org.keycloak.services.clientregistration.policy.ClientRegistrationPolicy	65e9a13f-13e5-431c-8500-c136a2014a70	anonymous
0d5f3713-578e-4aa5-95a2-04af7a86b009	Max Clients Limit	65e9a13f-13e5-431c-8500-c136a2014a70	max-clients	org.keycloak.services.clientregistration.policy.ClientRegistrationPolicy	65e9a13f-13e5-431c-8500-c136a2014a70	anonymous
0e86f085-549f-4f11-b1cb-1d3b32fa8d59	Allowed Protocol Mapper Types	65e9a13f-13e5-431c-8500-c136a2014a70	allowed-protocol-mappers	org.keycloak.services.clientregistration.policy.ClientRegistrationPolicy	65e9a13f-13e5-431c-8500-c136a2014a70	anonymous
8056b1e9-3021-4bbd-8167-c91d65e431e6	Allowed Client Scopes	65e9a13f-13e5-431c-8500-c136a2014a70	allowed-client-templates	org.keycloak.services.clientregistration.policy.ClientRegistrationPolicy	65e9a13f-13e5-431c-8500-c136a2014a70	anonymous
5ffea429-8b41-40a0-b771-8d34cbf25203	Allowed Protocol Mapper Types	65e9a13f-13e5-431c-8500-c136a2014a70	allowed-protocol-mappers	org.keycloak.services.clientregistration.policy.ClientRegistrationPolicy	65e9a13f-13e5-431c-8500-c136a2014a70	authenticated
a99abd21-83e2-4c1f-8f2d-8abf208b15c9	Allowed Client Scopes	65e9a13f-13e5-431c-8500-c136a2014a70	allowed-client-templates	org.keycloak.services.clientregistration.policy.ClientRegistrationPolicy	65e9a13f-13e5-431c-8500-c136a2014a70	authenticated
696706c5-005c-488a-af45-54ad5c5641b1	rsa-generated	65e9a13f-13e5-431c-8500-c136a2014a70	rsa-generated	org.keycloak.keys.KeyProvider	65e9a13f-13e5-431c-8500-c136a2014a70	\N
79b784d4-8146-47c8-9fd3-07339f0e0ed6	rsa-enc-generated	65e9a13f-13e5-431c-8500-c136a2014a70	rsa-enc-generated	org.keycloak.keys.KeyProvider	65e9a13f-13e5-431c-8500-c136a2014a70	\N
f757cea9-fd1c-40dc-ae1f-4ac51165c5b6	hmac-generated	65e9a13f-13e5-431c-8500-c136a2014a70	hmac-generated	org.keycloak.keys.KeyProvider	65e9a13f-13e5-431c-8500-c136a2014a70	\N
6aed70a5-6ea3-479e-b3b9-c36dea4eba94	aes-generated	65e9a13f-13e5-431c-8500-c136a2014a70	aes-generated	org.keycloak.keys.KeyProvider	65e9a13f-13e5-431c-8500-c136a2014a70	\N
e7bbe061-d03b-4617-855b-7703f72f22b8	Trusted Hosts	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	trusted-hosts	org.keycloak.services.clientregistration.policy.ClientRegistrationPolicy	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	anonymous
38b31d3a-eccc-443e-8ee0-2d102439deaa	Full Scope Disabled	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	scope	org.keycloak.services.clientregistration.policy.ClientRegistrationPolicy	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	anonymous
63bb26d4-176e-401f-ab15-a5ad4330ea1d	Max Clients Limit	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	max-clients	org.keycloak.services.clientregistration.policy.ClientRegistrationPolicy	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	anonymous
6f528a62-ec3f-4510-9bf9-7647958a8fe9	Allowed Protocol Mapper Types	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	allowed-protocol-mappers	org.keycloak.services.clientregistration.policy.ClientRegistrationPolicy	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	authenticated
d57498bd-57f1-4695-b1e3-ce1545968f4e	Allowed Client Scopes	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	allowed-client-templates	org.keycloak.services.clientregistration.policy.ClientRegistrationPolicy	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	authenticated
d3ad23bc-5412-483c-902a-6e4b49c8614e	Consent Required	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	consent-required	org.keycloak.services.clientregistration.policy.ClientRegistrationPolicy	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	anonymous
0e3dff24-7431-410d-ad08-36c1bd205bf8	Allowed Client Scopes	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	allowed-client-templates	org.keycloak.services.clientregistration.policy.ClientRegistrationPolicy	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	anonymous
e914359c-a7d8-4ab2-82cb-cdf7abc13465	Allowed Protocol Mapper Types	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	allowed-protocol-mappers	org.keycloak.services.clientregistration.policy.ClientRegistrationPolicy	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	anonymous
26632a50-0584-4a5d-abee-c36e176f234e	hmac-generated	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	hmac-generated	org.keycloak.keys.KeyProvider	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	\N
a8939957-72ac-47d0-99e7-ab7e85e4c8dd	rsa-enc-generated	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	rsa-enc-generated	org.keycloak.keys.KeyProvider	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	\N
5ec6cc62-57b1-4fbc-a274-de95c8210ebe	aes-generated	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	aes-generated	org.keycloak.keys.KeyProvider	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	\N
e81316e1-7b1a-43ec-9a09-da3873896b98	rsa-generated	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	rsa-generated	org.keycloak.keys.KeyProvider	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	\N
841029ed-f41e-4acb-aac7-a8bce7883682	\N	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	declarative-user-profile	org.keycloak.userprofile.UserProfileProvider	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	\N
\.


--
-- Data for Name: component_config; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.component_config (id, component_id, name, value) FROM stdin;
bb15a9c3-e9d1-479a-a91d-91d695c5549c	8056b1e9-3021-4bbd-8167-c91d65e431e6	allow-default-scopes	true
b5cf8259-d720-496b-91b7-7865da894ed6	5ffea429-8b41-40a0-b771-8d34cbf25203	allowed-protocol-mapper-types	oidc-address-mapper
caef3ef7-0ffb-4705-b9c0-9e45ce614c1b	5ffea429-8b41-40a0-b771-8d34cbf25203	allowed-protocol-mapper-types	oidc-usermodel-property-mapper
0ce3fc94-c9d5-4d08-be00-34fc52867652	5ffea429-8b41-40a0-b771-8d34cbf25203	allowed-protocol-mapper-types	oidc-sha256-pairwise-sub-mapper
71d3434c-22d0-4ff7-b70d-5260fdfa4ec4	5ffea429-8b41-40a0-b771-8d34cbf25203	allowed-protocol-mapper-types	oidc-full-name-mapper
2f309f10-29a0-49d3-9fcf-533afe03d29e	5ffea429-8b41-40a0-b771-8d34cbf25203	allowed-protocol-mapper-types	saml-role-list-mapper
16422a94-55e3-414e-be7a-d8120ddb1018	5ffea429-8b41-40a0-b771-8d34cbf25203	allowed-protocol-mapper-types	saml-user-attribute-mapper
a481b6bd-810a-441a-b99d-4da0dbbc4c45	5ffea429-8b41-40a0-b771-8d34cbf25203	allowed-protocol-mapper-types	saml-user-property-mapper
936bb4ef-fa5f-424c-9d3b-7697f1a6fed8	5ffea429-8b41-40a0-b771-8d34cbf25203	allowed-protocol-mapper-types	oidc-usermodel-attribute-mapper
f464b243-d2ef-4092-ba42-83c471da42d4	f68b513b-b6d2-445d-a12b-3a1549b8bfad	host-sending-registration-request-must-match	true
e50c626e-ae85-4e38-9dbd-8fecc0305362	f68b513b-b6d2-445d-a12b-3a1549b8bfad	client-uris-must-match	true
1a51091d-1b71-4ac4-a9d6-24ab087987cd	0d5f3713-578e-4aa5-95a2-04af7a86b009	max-clients	200
315f0380-cfb6-4c5f-98fa-80c77eda9b46	0e86f085-549f-4f11-b1cb-1d3b32fa8d59	allowed-protocol-mapper-types	oidc-sha256-pairwise-sub-mapper
707220e8-c462-43fb-b534-d5f0e29c057e	0e86f085-549f-4f11-b1cb-1d3b32fa8d59	allowed-protocol-mapper-types	oidc-address-mapper
e12f66a1-d2e6-4157-9bec-9426f96cf0df	0e86f085-549f-4f11-b1cb-1d3b32fa8d59	allowed-protocol-mapper-types	saml-user-property-mapper
1c2fb7c9-3562-4cbc-8619-031832b0c946	0e86f085-549f-4f11-b1cb-1d3b32fa8d59	allowed-protocol-mapper-types	oidc-full-name-mapper
bef4576a-ff65-41f6-899b-a9fa88c23835	0e86f085-549f-4f11-b1cb-1d3b32fa8d59	allowed-protocol-mapper-types	oidc-usermodel-property-mapper
7e986cf9-6fe0-46af-b14b-00fe69a024e8	0e86f085-549f-4f11-b1cb-1d3b32fa8d59	allowed-protocol-mapper-types	saml-user-attribute-mapper
37dab84f-c37a-4116-bdf3-b43f4807f6c5	0e86f085-549f-4f11-b1cb-1d3b32fa8d59	allowed-protocol-mapper-types	saml-role-list-mapper
920f16d1-a471-4c72-af61-a178831f20bf	0e86f085-549f-4f11-b1cb-1d3b32fa8d59	allowed-protocol-mapper-types	oidc-usermodel-attribute-mapper
0840c623-0295-488e-8f1d-86034d715f68	a99abd21-83e2-4c1f-8f2d-8abf208b15c9	allow-default-scopes	true
0c90b618-1168-4204-80c5-5f917960f4aa	79b784d4-8146-47c8-9fd3-07339f0e0ed6	priority	100
dd946954-c2ae-49ae-b9b9-ce2d5578f81e	79b784d4-8146-47c8-9fd3-07339f0e0ed6	privateKey	MIIEpAIBAAKCAQEAqet40Bk01Q9C69abJfhbxB/aHrl8E+Gell3X72qXUYDRAC8DswI9++cHl1DYMLOs8pffl+cor1t/YgqzPoXA+N2Z+5zMbY89JCKI83Y35LjqyaWRfLr2I/NbTcSU0LFzSqZmTI66GqJrmND9poH8fQPpPxuJuwpxZkve91eCAWO1VcJAPJxcMpJEeva4H13fGFTgefhxfM42MA296NqHPbPG1HtXs0zlbJbeCsn8Ec/UlyM7Q46pMhPgyUusKiyqbUZ4ld8cgAQ9UBqesGbJKlEh49Y6VaqA/TEIAFQiY7NCUMQG25VeMPLuCMd8W1DlEtrCF0CIS78aDYTLmS32VQIDAQABAoIBAAYvLww54qGfhtLBEpAA+EwM0bo9C35Iv6Ye38FTupKpktHEJEkTW5Crwau48klhfLmum+FyNRmexaXamFf9875LCHPvKsSRCktio2PjCVk+frMcns0wm81GqevMbBMlZjoRENeX+T+Hak2bS6QQBpHBPu/AT5S6ZlKwD7smWPG2cVlu/CYfWuq70aBb7d1RYDgOMx40S6aTINSn9wDZZhaWD5srK1P+X+/ZWsVygx2QpT0GldGh3gdJGIZuY3RfWZu93TQKZAuhAVeWgnGeo+LpVlYRVxGTxjBko0SLaeAVeN+m/T8R6nkaVv4ajv7BiPHgsAap8CuuZU9c7BdTRrkCgYEA3Viqwj2kMXESkO/7ol/Q7HJT+eMQoyHsfQXAmWg4NJ1rRTV00B+Xp/4nzqRodICWTB+Fh7BddS1yT6GY1XyJq+x66VpFpzJAXF7GaTHbVJ7/83K27MzAvrlb373Pn3u6MhxqHd7eyTsrm906GaTbFOBN1GrOyJHi4RLTzyY9820CgYEAxIWupwKJneFuD6nUxbXCEgWc9hvCBBXyxYEK/FQoaCWKJH2yrmlfcKfZU7v/NkJkdTXsqBg0ANV5hx3+rUamuc3wWft9HWbESMVXUWl/8aCfzFQ7irg76lVYbUcj2Iak8219hsb6n0LpoNiqARex0F4qF1vmWZC/RbJNOzVR1YkCgYEAi6nO1REf8TJvjJRgKmxa31akNiBX9xcIqTpf9GwWStypOtooAspsXsu3QmPqpNgd/ZpGHv/heHZcknJchRg3pgto4qTbHkxO3/nNJ8MVqadJyMqxMWlglPdQSTTzNKZVLhlPu9lMqZx0P7yvVE75DYsakNVz9IpYpbvDegmfPWECgYEAsgzwZS4eYuWooxZayVpY350oTa5uhOch0qGMw3q4NUu1skQUTIL5zoa0l3Hf01gpziwyI0Xyb8L53VpmsLUvP25/UfdRrv653bi12PP90HyX6zdxzsgGuNPkTvXCW136Ova7YQ4MaZjlNS64ME84cjGubwV7WTCUq1/VK0yuvQkCgYBfflrhYys0BFxNaTi15/mzCAHUIDv1JTJjZ6KliHdjsEh43vaSMVO6W47zPL4XIgGW8J83TKvpHREEAbnGAvf5iRffzDHq7ogwWx3lUu+OuWCwMsxUe0BgvuHr+XuOLcP+k4p68rsa5rg032UhksRHQi4tWPAbYEtrFUQJxR8j7Q==
8af2ea80-77bc-4173-955d-909aeda578b6	79b784d4-8146-47c8-9fd3-07339f0e0ed6	certificate	MIICmzCCAYMCBgGDcIPGCDANBgkqhkiG9w0BAQsFADARMQ8wDQYDVQQDDAZtYXN0ZXIwHhcNMjIwOTI0MTcxODQ3WhcNMzIwOTI0MTcyMDI3WjARMQ8wDQYDVQQDDAZtYXN0ZXIwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQCp63jQGTTVD0Lr1psl+FvEH9oeuXwT4Z6WXdfvapdRgNEALwOzAj375weXUNgws6zyl9+X5yivW39iCrM+hcD43Zn7nMxtjz0kIojzdjfkuOrJpZF8uvYj81tNxJTQsXNKpmZMjroaomuY0P2mgfx9A+k/G4m7CnFmS973V4IBY7VVwkA8nFwykkR69rgfXd8YVOB5+HF8zjYwDb3o2oc9s8bUe1ezTOVslt4KyfwRz9SXIztDjqkyE+DJS6wqLKptRniV3xyABD1QGp6wZskqUSHj1jpVqoD9MQgAVCJjs0JQxAbblV4w8u4Ix3xbUOUS2sIXQIhLvxoNhMuZLfZVAgMBAAEwDQYJKoZIhvcNAQELBQADggEBAEkn1bODrcipPYNa/g3aTsI/ZH21We5wxHoqphiWrH7OvmLRkhseE1duKEC0PJkehrWA+kgEBjbuaG9qvlF5vgTvLABtxSzG6TJt7a0HkfwFuPx17h1wGUccM/VYb0rtyMmZBXrZnpvh9E+U0FZBkurxZ/w/FlgSlMvIcNWEZYuxCU4hf+Hs+wMHw50LYEAq0Kbd2rux86XK3KAaWOMtsEi//tGsV04Q84NvFDDI1hi83drxHXau5GiremWcfAGTwaNIJh54e/VLUeizFG7OKqAvS3j28iSahY+zemYf1CnqZm8uteK76vOdR/ri1K7T+2aMkeMu7F1GcF+e+E5gerU=
18e7c62f-54cb-4354-b269-5a6d81ef0a75	79b784d4-8146-47c8-9fd3-07339f0e0ed6	algorithm	RSA-OAEP
8c8ac731-28d4-4a83-bc48-0c196f8ab81e	79b784d4-8146-47c8-9fd3-07339f0e0ed6	keyUse	ENC
752af210-1f99-4e24-901f-3fa723c485bf	f757cea9-fd1c-40dc-ae1f-4ac51165c5b6	secret	ae7CUGkRsCW4Qo1scmbLdWlj1RJfxAGKsqkijO1sjwM7SY9N48RQcHlOJhJxZC1Pz3yuPunOHDNP2uRasCkqqQ
fcdc4a48-9002-4915-b80f-fc69b61e2ee1	f757cea9-fd1c-40dc-ae1f-4ac51165c5b6	kid	ab59a096-520a-4752-bfd6-80d2c8409847
e1c96dae-2ad6-4e0c-ab6d-9b633da48845	f757cea9-fd1c-40dc-ae1f-4ac51165c5b6	priority	100
ab55778c-4de3-4743-b8d6-c6b5d1af148c	f757cea9-fd1c-40dc-ae1f-4ac51165c5b6	algorithm	HS256
12ac638c-bbc7-426b-9350-bb3f2f526d54	6aed70a5-6ea3-479e-b3b9-c36dea4eba94	kid	643cf5a2-9e13-4082-a913-19a63c83a0af
d5de02ee-2733-47df-9723-ca2323e2b261	6aed70a5-6ea3-479e-b3b9-c36dea4eba94	priority	100
e54a9d29-f00a-41a9-98c5-585036b011f9	6aed70a5-6ea3-479e-b3b9-c36dea4eba94	secret	4jEfkf4ekC14P_wFg6ugzg
747346b5-3644-4307-9589-99df7ee94499	696706c5-005c-488a-af45-54ad5c5641b1	keyUse	SIG
a77213cd-7bd0-4502-8be2-5ec9d98dc346	d57498bd-57f1-4695-b1e3-ce1545968f4e	allow-default-scopes	true
d8e31b12-f83a-4e8d-a3f5-3b2eef55556a	5ec6cc62-57b1-4fbc-a274-de95c8210ebe	secret	wibmSbs-mTBA-ljqfPD63Q
e8bf2c76-a4bb-427a-a6b3-09a637ad4d8d	5ec6cc62-57b1-4fbc-a274-de95c8210ebe	priority	100
8026d8a4-ecff-4f71-ab61-4d21d6650471	5ec6cc62-57b1-4fbc-a274-de95c8210ebe	kid	fd12d772-a6f0-41b1-8a98-cf89093ec809
c9c7bace-9c8d-43d9-9e95-73058b490c93	0e3dff24-7431-410d-ad08-36c1bd205bf8	allow-default-scopes	true
97791b54-5b0f-4a54-9fe5-eb434bee0d37	696706c5-005c-488a-af45-54ad5c5641b1	certificate	MIICmzCCAYMCBgGDcIPE4zANBgkqhkiG9w0BAQsFADARMQ8wDQYDVQQDDAZtYXN0ZXIwHhcNMjIwOTI0MTcxODQ3WhcNMzIwOTI0MTcyMDI3WjARMQ8wDQYDVQQDDAZtYXN0ZXIwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQCoiyqhAcFwKqymyd00yGeeM3tKRmprfIC+J+oGyd+9OXs4wOYyc8uzDj27fA4byYphyNpRYyPcFLKsPl6rxU/MB7eUoCs6EDmiUpdv4PBQ4mtcKaqIQ3HDW5TLRvNY5LcE11yGvgKgfeS9rbE9MVarlDzjTRt7XvZgLC7p0xBK9KenN7zE4+mPgQfxbs6qL8CBzEtfeyQR5u5hiC3m5xa6CEaEBNquE/XyZhN7h4G5DAcyZO7I/GKXKKVNfrS5l8Yx4z3IvjTodRX25wdPXh9Mj2KwtugZko+1wg52FsJE8+3zaDJsrgyYv7pLFyhYyU3nJrI72i7tsT5m899aHQMTAgMBAAEwDQYJKoZIhvcNAQELBQADggEBAFef8Zsv9twQkYWkvwtL725NPnorsIyAZ1KwLCo7+NBxhYOw5g7HW80piB07ilVg8UKMQq07HwiK7VAi8Fspned/OeeQ4s0c/PcQUZciNdcWmdR/NFqkO6MqJvAUqTu3ozJolD8asLCi6wimjy6uEflWrcS6peoqIzM15/UUnUCX3/s2OJnlZsvlC24PKq1qlB3eSN44Ns6wMzUmzjV6NiRIaUe1P0i0do7hmplaA8nEBBH/9GOh7TWARREja0lMaRpEys5i53QBQId9xK3u0L+9IaNqJ/hLEIaajmE9yi78kLF4mKo2UOFM6/AOXTN2UwLutJg/aPKEoAZRbIq8YKo=
be8f6cba-3003-4303-bb04-e8d18a1d7514	696706c5-005c-488a-af45-54ad5c5641b1	priority	100
824c6d1b-ead3-4821-a2a5-3efc58f949fb	696706c5-005c-488a-af45-54ad5c5641b1	privateKey	MIIEogIBAAKCAQEAqIsqoQHBcCqspsndNMhnnjN7SkZqa3yAvifqBsnfvTl7OMDmMnPLsw49u3wOG8mKYcjaUWMj3BSyrD5eq8VPzAe3lKArOhA5olKXb+DwUOJrXCmqiENxw1uUy0bzWOS3BNdchr4CoH3kva2xPTFWq5Q8400be172YCwu6dMQSvSnpze8xOPpj4EH8W7Oqi/AgcxLX3skEebuYYgt5ucWughGhATarhP18mYTe4eBuQwHMmTuyPxilyilTX60uZfGMeM9yL406HUV9ucHT14fTI9isLboGZKPtcIOdhbCRPPt82gybK4MmL+6SxcoWMlN5yayO9ou7bE+ZvPfWh0DEwIDAQABAoIBAAD9JAhiysA+N9oYqBgVrunyMmB6rkgoKFc1Q727dHkXO75W/2K/ZCwOQtV1Ql3uXkX5mDJPCxhQ9MVm7kZCt5eiWfTgxbAnBTeLFYFeB/rpgSi+w9Xd026KfIJ+zZGxcdNw8gWGWtyXMH7eZIJP5krGaV8KBkXAhmCFEddkWh2edGXeQ6/M1IRBgJWBBGxkKKiewP6ulR6u22agFGFUUAEntAMybCl9WdaqTJpo1WYUHNbVnYdQJj6grtGjDPd08iOK3BPnkCM7blu2J8DULa7NuxU0+aH74AlbEt+98PQm9nA2/R9+fw0j4KWNaSYv4ZveZUJN6B2HNmd+y1r01L0CgYEA3rZgoOQC5QFRBlRyPqcIns5xJULsdTkp5KuGmXD6hqzMyq0ofIhC3ENglx7M0jK/lE0r8lzfUu5/0Z7O4x7DmqGcCfuJ8Pfqlqx00XjgRI4XlG5tsYxVxYI2bMtdZ+7tOZ56sQBD98xNqMihWFxVZyjc7EPgN/oI8srG902KxAcCgYEAwbwiTsTndwQFgHGkZHadRyHv4Ok9QSVSHwc/KakP9fDMLwGD6QaD+2EH+GUYBnhPKrD80oZLS7qvMAP++uEhAaBCIPu3Zl1af9yUhb6RfODQbsIUuL4rIe7lB1L2JK1NOAq9V9KJArsuobOw7zawoACIRgCFgNDRSXlr7Iry/ZUCgYBK+dz37SroS5QqbF11qCfnxpoisDAImrD20aPjnjxJAH2FMdwyaHER1AD9fxn3HayPUZec5RUtxyryt+LwZRf2w7dTSQI8REoOZYqCRo5BphBcIPz+y77IWjjWUXRlm/Ly9d5aHjvDfV0bmEdxBsydiQ0u4P7n+V3v1sI62TkBGwKBgFhkzIqAENQew5vdPhKQhCZGd7p48PfeXV/G4KzTdHLUkXUJDfSugl2Z4hcVmSaqkgR6iIBNweElpnUT/azeNz8Urdd6wi00fuxD6ogzcRI3SSKf7vBz5B4xb9Itqh0F7WuaitWdO+JBIX+qCxq6K1B1rbey2TbzD+qkOffNVh0ZAoGADubDOJKXvRvjg9lOTWdLGRtiFU+0NeLqLe8XESTJkx3c7zJGSBR+grbTm9YRo7+A7HgDP0SKHFsKnyPLLMXCvjgFpxWim2UJQ4Ynnui7KOKoOr2NJtLaeL1YsTm4lEm5VTnofqDM6/bfWUjQr4DYPkmWNrocNMNsss+/eQ5gG7M=
47cc5deb-5bea-4957-828e-8c8d4d3c003f	e7bbe061-d03b-4617-855b-7703f72f22b8	host-sending-registration-request-must-match	true
c29b8b57-1964-47f6-81e9-acd73d723f5a	e7bbe061-d03b-4617-855b-7703f72f22b8	client-uris-must-match	true
4d553e07-934d-4934-9b68-349faf8cc98c	26632a50-0584-4a5d-abee-c36e176f234e	algorithm	HS256
48dcf2c0-5ec3-40b8-afcf-6290562bf969	26632a50-0584-4a5d-abee-c36e176f234e	secret	Mg7HkwglrkuacyXZXuvgMOGWMPz05XPR8pwOeltyKpzVTszNr5vVhGAMlHD0yc97BtL8GQjv9gO0E7Zz3DTqzg
ac87a1ef-5c94-4828-8cb7-fac3261bc13a	26632a50-0584-4a5d-abee-c36e176f234e	priority	100
c264482b-a962-42e6-9b72-483af258bf31	26632a50-0584-4a5d-abee-c36e176f234e	kid	4225ec48-3f58-4307-905a-3f6ac902919b
0fff4f82-a5cd-4780-9d24-cf2e6908772c	a8939957-72ac-47d0-99e7-ab7e85e4c8dd	priority	100
67159cce-51ea-408c-b776-d2dca59455d8	a8939957-72ac-47d0-99e7-ab7e85e4c8dd	algorithm	RSA-OAEP
7feaded9-2ba9-4660-bc29-84ae030e9a62	a8939957-72ac-47d0-99e7-ab7e85e4c8dd	privateKey	MIIEowIBAAKCAQEA04tUNvOB5UIMtHXfRCXcz176521dFfb8sfcTFxT3rXXic8Hf6NPdbUlQfHV+DO6/6Ulsu216JNkRjicopqSjqeNgb5zRKv1OWHhXR3lpDltWyAML8B/4kPshHS04Of8GBMWxuldE1o5n8rg+qf2qgAT5CSiFYP0EaoL7h6T+tCkY8KEr7Z6sUit6MgM8g1iBi3KGMysDMsIRLspNNrpHdc4xD84VG+xbawXPQblJIirWehq/DhZX9gn1dl51lV7TlTgPY8D3sMsnTy9lRuAcn2wfKTUB4canN10zWChXUaE2f9MgwE5kv7SN5mnNwBZMtr8DXmPylpz6so+CBH0ZzQIDAQABAoIBAAkuOe876HkRbD66rNVRdVXp5SanrYtXUYZ3AV+WO9zNybrvVi8jCVra/IC3kqBaDinAKNVbfhpc8fDtjHXq8uVbu6LXDJF6i8IK0EgxodhgfhF7vF1lQyLQ8JIfv8Rt57jLoZfDfiEiQ1WadFxpPf3Z+WV8hN6oLF8OTyncWby/cE6wU4MvWq+uTW6petVMsH/50r2Z8Yu39CWiFdZzWQ487HdF9XEQqwPJbZYmMSLRJ611h9Y9fkw+wWdVV9CHv+Xm934kloPZ0U22bTgIVChA8Sq1RVbuu0qilySkYxoqhIgkEUo46DAGuxPVvRm1A248EcZ49HIdJA4+0rp4t7ECgYEA7oDJy4lNbLaZk5lMUaz7jJyugtXnjpdML29O6DHlUsLoENaRvNLoSy4vSUK5w/xOXLKMbQHGhnIOzZCGrmFzxr98vUuBOnbbxgDpjQFGQ/2zrL9mYxc0s43MopHqewoFNMjNIi8glsphfk8OJUxZkvIkrKuSnLYsnAbGkm1b46UCgYEA4xA9barKj9jtS2UDK5LTEPxMRFeql6LXW8MXaZdRyFEXW3oE0fHoUYsH3+htBSeTQQig6SIrUQGsbgWMfMq8s7o/Byrjd0etLgNVtSCLBc8H7o1KiwfzIEnpNtHVxfe+7WOAVmtq4jOHIvtzCT8WOhz5/LNxKx3Jgh1fNTsKZQkCgYBrry5tfYK9sPxKTg7NWcMBy8RnQlkYYmt9h04jPFQEOAg7ggWvMbK8LxAejcf+Gy7uX5dTqFeQYHMakUSd+1YgyFhzx2GDmiLElajdh1PIYwX62zhJSTL8VuusAyHRh8at/HPSGWEndBzswJjscjqHRFkWtSivJPmjQNPrTQEOGQKBgHUHf8GwT2rIkbVUQMgKisKsZtqqnIA/K+Rdrwl7NmmacgFx6F4U4np0wABFmTsY5KqWOeku9UhxJmAmd/wxugSgL7AQCOEHjliy20/ZkA3UYPAw3oS9+i9gKNVaXWYFhOBxckoYXyRrDnGXS/kuDNSy7p2yFtf0KFHptZKH9ZmRAoGBALBCcX0svI9jqZ79OCo8z5ka07iqxJaZ16BCV6/8myqkQ8fx0dOG5PPYTARJcQAoa2o0SVj1cuq9x94VTfRHeN0tjpVF+WpcZFS5NHM6bfQGw8gXvKeZZPV4XVGdlnzuBZJk5WCb6UgG4BBVtGsW/1Gf6AvDKBZzgDPf4n4VJp5C
a78659e9-56ba-4077-94b6-346a1842815a	a8939957-72ac-47d0-99e7-ab7e85e4c8dd	certificate	MIICmTCCAYECBgGDcIPM5TANBgkqhkiG9w0BAQsFADAQMQ4wDAYDVQQDDAVob2N1czAeFw0yMjA5MjQxNzE4NDlaFw0zMjA5MjQxNzIwMjlaMBAxDjAMBgNVBAMMBWhvY3VzMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA04tUNvOB5UIMtHXfRCXcz176521dFfb8sfcTFxT3rXXic8Hf6NPdbUlQfHV+DO6/6Ulsu216JNkRjicopqSjqeNgb5zRKv1OWHhXR3lpDltWyAML8B/4kPshHS04Of8GBMWxuldE1o5n8rg+qf2qgAT5CSiFYP0EaoL7h6T+tCkY8KEr7Z6sUit6MgM8g1iBi3KGMysDMsIRLspNNrpHdc4xD84VG+xbawXPQblJIirWehq/DhZX9gn1dl51lV7TlTgPY8D3sMsnTy9lRuAcn2wfKTUB4canN10zWChXUaE2f9MgwE5kv7SN5mnNwBZMtr8DXmPylpz6so+CBH0ZzQIDAQABMA0GCSqGSIb3DQEBCwUAA4IBAQAMnityFni2hi1g2Ye8uVSHEKPQ1oyRw/u6gszpqcnPcJ3PUOXvRcK2LXcp7WS0zgautzWTUIwPLkwqe0FPWecbw8F271PIpY64aCnF6k2ZSywb8rj68CEk9nwH4SZU1isjGVF95v5fKoTRsPMkUvPvANJvIg8uPpNKamU7MZ395whjIKp1P+ieEMPCbEiPZRDv227ybkOzGERm4RGvnxkBcNo6qeO2blGPivtHAwWdYyHBfB0q9Mr9S/2evXVUW7CIAdr22yqEUxXZKIAwyLR1ngYnqM6VTeCcm+QbqukHGWUqrpu9vlWeGHqihs6HR9BJjFHrkeJsCLEkNJMmOjWN
7f8b74cb-b706-42fa-92cc-627b9aa5b544	63bb26d4-176e-401f-ab15-a5ad4330ea1d	max-clients	200
4efad243-e6c8-47fa-bcdc-6bb06688af4b	6f528a62-ec3f-4510-9bf9-7647958a8fe9	allowed-protocol-mapper-types	saml-user-attribute-mapper
841fe871-8ef0-4e95-a8bf-3f06bf73070b	6f528a62-ec3f-4510-9bf9-7647958a8fe9	allowed-protocol-mapper-types	oidc-full-name-mapper
29251958-f991-4a25-a5c9-6d71774f1732	6f528a62-ec3f-4510-9bf9-7647958a8fe9	allowed-protocol-mapper-types	saml-user-property-mapper
b8bb31a5-71fb-4379-af4c-47a84917823c	6f528a62-ec3f-4510-9bf9-7647958a8fe9	allowed-protocol-mapper-types	saml-role-list-mapper
0ca33965-81cd-4ea8-aa85-9f24b886f2bc	6f528a62-ec3f-4510-9bf9-7647958a8fe9	allowed-protocol-mapper-types	oidc-usermodel-attribute-mapper
9fad33fb-cb00-4642-88c9-15ebf5346df6	6f528a62-ec3f-4510-9bf9-7647958a8fe9	allowed-protocol-mapper-types	oidc-usermodel-property-mapper
7c189c33-bb13-40cc-8206-2ab6eb1b6b35	6f528a62-ec3f-4510-9bf9-7647958a8fe9	allowed-protocol-mapper-types	oidc-sha256-pairwise-sub-mapper
790b5cfd-4417-4ae7-8c5b-abf27f706f25	6f528a62-ec3f-4510-9bf9-7647958a8fe9	allowed-protocol-mapper-types	oidc-address-mapper
6e36b610-1435-472b-aaef-386fc6bc5b38	e914359c-a7d8-4ab2-82cb-cdf7abc13465	allowed-protocol-mapper-types	saml-role-list-mapper
d2e1dca1-d924-471c-a866-b2de4d62f93b	e914359c-a7d8-4ab2-82cb-cdf7abc13465	allowed-protocol-mapper-types	oidc-usermodel-property-mapper
c408ecd1-a596-4937-8a5b-557ddc4d977e	e914359c-a7d8-4ab2-82cb-cdf7abc13465	allowed-protocol-mapper-types	saml-user-property-mapper
ecaf64f2-a921-4449-a29f-8b6d0daf50c0	e914359c-a7d8-4ab2-82cb-cdf7abc13465	allowed-protocol-mapper-types	oidc-sha256-pairwise-sub-mapper
6162a414-f775-4314-acc0-9c4efca54960	e914359c-a7d8-4ab2-82cb-cdf7abc13465	allowed-protocol-mapper-types	saml-user-attribute-mapper
77214bcc-5912-4341-8c26-4669905691fb	e914359c-a7d8-4ab2-82cb-cdf7abc13465	allowed-protocol-mapper-types	oidc-usermodel-attribute-mapper
63ebc4bb-4a2e-4288-80ad-bd52b1cedbc8	e914359c-a7d8-4ab2-82cb-cdf7abc13465	allowed-protocol-mapper-types	oidc-address-mapper
75ec964b-58ac-4a06-8d07-521660f37f1d	e914359c-a7d8-4ab2-82cb-cdf7abc13465	allowed-protocol-mapper-types	oidc-full-name-mapper
70753a95-0bb9-4fff-bd07-1b1ddbb66bbc	e81316e1-7b1a-43ec-9a09-da3873896b98	priority	100
9776d6ab-841b-41df-8ff3-a4f9d7ef10ff	e81316e1-7b1a-43ec-9a09-da3873896b98	privateKey	MIIEogIBAAKCAQEAsouC3HjqtUBwIGCH/nUNklNmqzMKjWmhwxoEpz1L1kiPcgs4rGVsYu828ddoVbYYGvNhGdzyHmb2/wuPTgLX6QVZCO4qrq2p0c/beJ4oJTD+no2b2ewTL0augO95p1CJv95fDsAhle9qje1xuJ3pvtMjJNdrK46d17N1NpPpDI2xzGCerM+b5oiFyR13q8p7AvbENUbWhMFBdghVR+JbyLGb6gTVpSPEO7dHh5zFKsmmLLHMQfnshWmFhH7ERwOMzonmjnakK6znr7LeZnPGX8vmoCw24iymQ/fFAry3EhotJEmwmeVEzu72jY3KjI6liv4F52PTPiwBtK4wgdXsmwIDAQABAoIBABUkD8qrRp9PkfdDdtbaZVD+Lxn2YTl9WHoRipuC1of474NBcOR43eyZBph8OQ5tEU2fo8+8Ka8P4g8w/zbtf0NILtKv4L3uMj11rzcJAxfkRUHg4qNbIKpoZCFAOddl4emmGvtUJKXsQ2Gqy9xgVl0SAwdJupbdvDLePPLJcL7blSvuIrYXsj9QOk0U+qzg7yCGJW7tSZXbd+c6SCQNoB5LjomBDsZAwhUJhY1sqMedoOJSJWpiv6OSiUjAQWGHZuU2y8ddpKXgmZjxBwkZr3TcD8noqlfkQX3O5hROSk5Y3w/qVgWtK9tRG1tnBf4fMIG3+2fcYPB2Mx2OaJj3dAECgYEA9HwOZzc5Il9+bBmaDgL1/CJsLCYiY1oBbKCCXJ9bqfwGkNhaDn9qpdrYut7yAZ4Q+MTkL1AtI4qDgqAb8iD2EkXEHa9V0B3SWian+0ZWcuImGqqLQImxiISoIh6qbO4ajKnlfY47ywLmU/AD8yqjFwL1dvgit5HiSwmZrW5IQLsCgYEAuvReZtMy93Lmaw+aYa5A1WTaoN1vpkNkD9zXR1xT4n6w9DSEgC0g08MxEfjTM9ZoKoEKDxJBoj1VfPo9icbAqiar41Lw7UYosJXjTOLcpeGOayswZKUQLxkHuPRKSTIlMEmFQdMUDEFQM1t7BBQoTZPkwqroJDj8APgYAPxTtaECgYAoTdtCAMSWeg+pWn8fGDXdHv+eN5srrcbWVY+oHU1LNJUQg9o00aSPOwjHpcFXqus5V5wWgK0wUsFjY2m3/N8UHBQ8oI8RBBmNaxn+PpY50jZd5weV2B1AWD4vgcautoIB9nAyxqPsz8mQxNyh1cGVJZO5zSZMBOy9WhPPl4KpyQKBgDPXYXoH5KEjVmunpvqhNE84KTvkS3qCQ3P2nCeonYY39V+yVG+qk+jEvo2qPv6n3Li0kZJ+UH7pnRQL3Baha3mDQbTGohJZmxzkY2RFoEPLWQ+0qTWvY957hV2vOA41/oP2TyJiorOHRPMI0gLeiBKDCTNF6xtoRdEK+rUDQz8hAoGAOt9wnjY9ejqEUSsPhuFpxvo9edWpKBTrwlIsGx6wHSWCRbkck19KexR/aH43MY7aTvK8uf9Zr1T0H0TheGtuwgTd+oqNXZ1aO6/0xN+fLnjnzJ7sdcJ792WnRmLp6O2WFBadM/iNfiRxUngz54GjwkU0PviY6ZxH7EFEHqyE77o=
42d3b6fa-8bfe-45f4-8e13-ed4ff297c91f	e81316e1-7b1a-43ec-9a09-da3873896b98	certificate	MIICmTCCAYECBgGDcIPNUjANBgkqhkiG9w0BAQsFADAQMQ4wDAYDVQQDDAVob2N1czAeFw0yMjA5MjQxNzE4NDlaFw0zMjA5MjQxNzIwMjlaMBAxDjAMBgNVBAMMBWhvY3VzMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsouC3HjqtUBwIGCH/nUNklNmqzMKjWmhwxoEpz1L1kiPcgs4rGVsYu828ddoVbYYGvNhGdzyHmb2/wuPTgLX6QVZCO4qrq2p0c/beJ4oJTD+no2b2ewTL0augO95p1CJv95fDsAhle9qje1xuJ3pvtMjJNdrK46d17N1NpPpDI2xzGCerM+b5oiFyR13q8p7AvbENUbWhMFBdghVR+JbyLGb6gTVpSPEO7dHh5zFKsmmLLHMQfnshWmFhH7ERwOMzonmjnakK6znr7LeZnPGX8vmoCw24iymQ/fFAry3EhotJEmwmeVEzu72jY3KjI6liv4F52PTPiwBtK4wgdXsmwIDAQABMA0GCSqGSIb3DQEBCwUAA4IBAQBYxby6aD3f3BpXrXrLoiOjxPYotxfsrNKmFagTZL1c33MrwJW5MkzbG/gIGjL698RYFVI8j9vxAXeZ2bNpC8pOhfW9oZCYk2Rzbdu0kKyRPpRa+GealEPUqrP5fuA6oVt6k6wdKgvnPNKnvdEMaWEQDr2uSNbhGfNEOzLeUzgvKjKP2KIhN7H3HuaXnxcWtSnosqu2X3C6QHQkT/b/0yl5ACiXRbyfcm/YlNuqGJVzEp4IjYLBA85cgsPTUA/xKrA1B/jTlpSi1uMm3C+u9QVIbz8hFiRc1FGkJtV2iASB4bf7iIg9GznpZ/mAeuLkfgrHiyTXw5rAUIDn8k6x0xk2
\.


--
-- Data for Name: composite_role; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.composite_role (composite, child_role) FROM stdin;
88d4f17e-2eb0-4b28-8ce2-7d53301ad91a	a15967b7-68eb-432f-bb81-41e8e6790dbf
88d4f17e-2eb0-4b28-8ce2-7d53301ad91a	a597e125-acc5-451b-a6cf-b38ccbc595bb
88d4f17e-2eb0-4b28-8ce2-7d53301ad91a	d37ab9fb-07be-4130-9441-9b530c9fc6a9
88d4f17e-2eb0-4b28-8ce2-7d53301ad91a	fd39cd72-2cbf-4653-94e5-62d24b168818
88d4f17e-2eb0-4b28-8ce2-7d53301ad91a	afc835f8-6277-4f63-9173-2c5855159462
88d4f17e-2eb0-4b28-8ce2-7d53301ad91a	4da9c86d-55f6-4107-b914-20bb95a91e34
88d4f17e-2eb0-4b28-8ce2-7d53301ad91a	b48eb883-b7f4-4ec3-9792-6a87d5c2f525
88d4f17e-2eb0-4b28-8ce2-7d53301ad91a	ac080123-5ea2-49dd-9b55-582eed3a4183
88d4f17e-2eb0-4b28-8ce2-7d53301ad91a	f9061798-3ae6-4773-a3c6-9da30f156f2d
88d4f17e-2eb0-4b28-8ce2-7d53301ad91a	d4dd55e4-acdb-4d98-b235-1890cd09ee2c
88d4f17e-2eb0-4b28-8ce2-7d53301ad91a	4d06737e-feb5-464c-bd54-76095ab54646
88d4f17e-2eb0-4b28-8ce2-7d53301ad91a	7125808b-4127-4d1f-b168-ddcc13dfc106
88d4f17e-2eb0-4b28-8ce2-7d53301ad91a	0adfb59d-6561-4d35-9073-4326b1971e57
88d4f17e-2eb0-4b28-8ce2-7d53301ad91a	fdbebaa5-eb32-4c94-b913-6a4b8c3bf64c
88d4f17e-2eb0-4b28-8ce2-7d53301ad91a	5db2bbd4-caa8-4bed-bc3c-1e51d403efbc
88d4f17e-2eb0-4b28-8ce2-7d53301ad91a	5f997de8-76ce-4a16-ac5a-5932b3b348a4
88d4f17e-2eb0-4b28-8ce2-7d53301ad91a	1aeb92eb-b1e2-46ce-8446-db96f750465e
88d4f17e-2eb0-4b28-8ce2-7d53301ad91a	85fd2e0c-1d39-4ba6-916f-4c52cd526adb
afc835f8-6277-4f63-9173-2c5855159462	5f997de8-76ce-4a16-ac5a-5932b3b348a4
c3729e00-622c-4432-b7c4-30929326b88f	0c2bdcc1-aec1-4ca6-8312-f146e266db95
fd39cd72-2cbf-4653-94e5-62d24b168818	85fd2e0c-1d39-4ba6-916f-4c52cd526adb
fd39cd72-2cbf-4653-94e5-62d24b168818	5db2bbd4-caa8-4bed-bc3c-1e51d403efbc
c3729e00-622c-4432-b7c4-30929326b88f	6fb1586d-36cd-4b67-84d7-b3d8b6b0e468
6fb1586d-36cd-4b67-84d7-b3d8b6b0e468	07edb37f-819f-441f-821b-7f273053bd65
97f79fea-d057-4b83-91aa-7212ae2600f9	16dea087-0a72-4672-9efe-f2a7c56f1b1d
88d4f17e-2eb0-4b28-8ce2-7d53301ad91a	c1f9a997-d404-459a-9cde-68975c2f2c9c
c3729e00-622c-4432-b7c4-30929326b88f	46d240ee-9839-4dc4-b1ff-fdc1d067ce70
c3729e00-622c-4432-b7c4-30929326b88f	4d619a87-64bd-41c8-878b-8b4d32d200dc
88d4f17e-2eb0-4b28-8ce2-7d53301ad91a	2490abeb-9550-49c9-8110-04f214defa07
88d4f17e-2eb0-4b28-8ce2-7d53301ad91a	bf37b9e5-fba0-44b7-bfb6-eda946cdabe8
88d4f17e-2eb0-4b28-8ce2-7d53301ad91a	24ab2cec-5293-467b-bd30-0a329f8a69be
88d4f17e-2eb0-4b28-8ce2-7d53301ad91a	8f79a5fd-3259-4a2f-ac18-627aa9cd59d0
88d4f17e-2eb0-4b28-8ce2-7d53301ad91a	356751dc-098d-4540-b866-27d70bc58aad
88d4f17e-2eb0-4b28-8ce2-7d53301ad91a	9862cc78-f1d1-4de2-aa33-943aa5fa3bac
88d4f17e-2eb0-4b28-8ce2-7d53301ad91a	1affecc8-f820-4195-87fb-b569670d4dbf
88d4f17e-2eb0-4b28-8ce2-7d53301ad91a	e7a3c11c-a97f-471e-8da8-6740f15aee82
88d4f17e-2eb0-4b28-8ce2-7d53301ad91a	be2a5918-a320-43ba-9593-e9fb3ec9a684
88d4f17e-2eb0-4b28-8ce2-7d53301ad91a	fb972515-64bf-49fa-b284-3e3d9d8b1f70
88d4f17e-2eb0-4b28-8ce2-7d53301ad91a	dfdcef3c-58c0-4dbd-bb79-e0485735db27
88d4f17e-2eb0-4b28-8ce2-7d53301ad91a	8a033534-b955-4485-87bb-8aad704e382b
88d4f17e-2eb0-4b28-8ce2-7d53301ad91a	641895e2-e368-438a-ad77-c04543840c42
88d4f17e-2eb0-4b28-8ce2-7d53301ad91a	9ff17634-c68a-4d9a-b580-d5be62df37e1
88d4f17e-2eb0-4b28-8ce2-7d53301ad91a	19f320bd-8269-46e6-b597-ab6815adbbf3
88d4f17e-2eb0-4b28-8ce2-7d53301ad91a	c09efdff-83aa-4093-8ba9-b6941b3e0343
88d4f17e-2eb0-4b28-8ce2-7d53301ad91a	eb7d41c5-fc19-4635-af6c-4aff5a4e7f05
24ab2cec-5293-467b-bd30-0a329f8a69be	eb7d41c5-fc19-4635-af6c-4aff5a4e7f05
24ab2cec-5293-467b-bd30-0a329f8a69be	9ff17634-c68a-4d9a-b580-d5be62df37e1
8f79a5fd-3259-4a2f-ac18-627aa9cd59d0	19f320bd-8269-46e6-b597-ab6815adbbf3
e8c01625-cda6-4510-a2d6-29214855ce90	feff0cce-4e03-43e6-96c6-decd66171a38
20da747e-168f-405f-a92d-7ed1d53060c6	0cc35a9e-37d9-4970-9b63-4e173ab8223b
20da747e-168f-405f-a92d-7ed1d53060c6	eca1901b-02c0-4bfe-8d18-dac948248389
20da747e-168f-405f-a92d-7ed1d53060c6	9f7ea7dd-745a-454a-b4e3-40106ca04ca9
20da747e-168f-405f-a92d-7ed1d53060c6	15586d42-a56d-4d16-8a70-d18b78dfd79f
20da747e-168f-405f-a92d-7ed1d53060c6	6c2366a8-04ae-4af9-afda-3754fcc97360
20da747e-168f-405f-a92d-7ed1d53060c6	1152ffba-aba0-41f7-b01f-05a415ea6d45
20da747e-168f-405f-a92d-7ed1d53060c6	ac5d1940-8f22-4822-beb5-266f7fe047fe
20da747e-168f-405f-a92d-7ed1d53060c6	3786733d-00e6-4578-92a7-56ac6a4794e1
20da747e-168f-405f-a92d-7ed1d53060c6	87d629ac-6864-4d30-8569-c069c1364075
20da747e-168f-405f-a92d-7ed1d53060c6	fd78854c-2d52-4313-8deb-e15aca94b90a
20da747e-168f-405f-a92d-7ed1d53060c6	ea559493-7476-4ec9-9e87-0ffc787176ca
20da747e-168f-405f-a92d-7ed1d53060c6	0adecfab-3162-4eb5-add3-a58a157b1738
20da747e-168f-405f-a92d-7ed1d53060c6	e75026c4-67bd-4242-8fd0-0e47157ae9cc
20da747e-168f-405f-a92d-7ed1d53060c6	4e519f62-0a7e-47cd-b316-a3250dbf7da4
20da747e-168f-405f-a92d-7ed1d53060c6	f6d949b1-8daa-4d5c-85db-d932b519c219
20da747e-168f-405f-a92d-7ed1d53060c6	44429678-bbda-4bd7-925a-d36a70f2ee69
20da747e-168f-405f-a92d-7ed1d53060c6	b506ab77-fc49-4146-81b0-83545d6c8945
88d4f17e-2eb0-4b28-8ce2-7d53301ad91a	11419487-bfd4-4ad2-9e28-c1cda8f7fcff
15586d42-a56d-4d16-8a70-d18b78dfd79f	f6d949b1-8daa-4d5c-85db-d932b519c219
9f7ea7dd-745a-454a-b4e3-40106ca04ca9	4e519f62-0a7e-47cd-b316-a3250dbf7da4
9f7ea7dd-745a-454a-b4e3-40106ca04ca9	b506ab77-fc49-4146-81b0-83545d6c8945
20da747e-168f-405f-a92d-7ed1d53060c6	04086f50-8d9d-4f9f-886c-8bce2426821b
e8c01625-cda6-4510-a2d6-29214855ce90	24999798-ea13-42cc-b508-051af1110258
\.


--
-- Data for Name: credential; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.credential (id, salt, type, user_id, created_date, user_label, secret_data, credential_data, priority) FROM stdin;
19d1b731-6542-49b0-9302-55a29995928d	\N	password	08766cb6-30f0-4060-bbae-b5cde0c325be	1664040030099	\N	{"value":"q7oESsAY9uMIDHIn1Oa8BpALcMCKtYbC9/Ae5U7qgMDiJM0qyAZYGtg+Kxt/BNDUIgrHoQOu445ceiQ+BpuPGA==","salt":"5FyiTLRcJ98EOLa1PccVTw==","additionalParameters":{}}	{"hashIterations":27500,"algorithm":"pbkdf2-sha256","additionalParameters":{}}	10
738fb444-a457-4fbd-9242-b1583928d48c	\N	password	7480bd02-16d0-4727-a3dc-3832144aaa95	1677336830385	\N	{"value":"I1hLQ+SbFZd6+aGly0T9PJKWIn9rXlpiCEe+saSVak9md2f3cngNKWnuDKJpijkqRVCnwVk091iwmOTRiHuC2Q==","salt":"lvlNx58cNifCmI3OrCfLgg==","additionalParameters":{}}	{"hashIterations":27500,"algorithm":"pbkdf2-sha256","additionalParameters":{}}	10
\.


--
-- Data for Name: databasechangelog; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.databasechangelog (id, author, filename, dateexecuted, orderexecuted, exectype, md5sum, description, comments, tag, liquibase, contexts, labels, deployment_id) FROM stdin;
1.0.0.Final-KEYCLOAK-5461	sthorger@redhat.com	META-INF/jpa-changelog-1.0.0.Final.xml	2022-09-24 17:20:24.592828	1	EXECUTED	8:bda77d94bf90182a1e30c24f1c155ec7	createTable tableName=APPLICATION_DEFAULT_ROLES; createTable tableName=CLIENT; createTable tableName=CLIENT_SESSION; createTable tableName=CLIENT_SESSION_ROLE; createTable tableName=COMPOSITE_ROLE; createTable tableName=CREDENTIAL; createTable tab...		\N	4.8.0	\N	\N	4040024026
1.0.0.Final-KEYCLOAK-5461	sthorger@redhat.com	META-INF/db2-jpa-changelog-1.0.0.Final.xml	2022-09-24 17:20:24.601017	2	MARK_RAN	8:1ecb330f30986693d1cba9ab579fa219	createTable tableName=APPLICATION_DEFAULT_ROLES; createTable tableName=CLIENT; createTable tableName=CLIENT_SESSION; createTable tableName=CLIENT_SESSION_ROLE; createTable tableName=COMPOSITE_ROLE; createTable tableName=CREDENTIAL; createTable tab...		\N	4.8.0	\N	\N	4040024026
1.1.0.Beta1	sthorger@redhat.com	META-INF/jpa-changelog-1.1.0.Beta1.xml	2022-09-24 17:20:24.635205	3	EXECUTED	8:cb7ace19bc6d959f305605d255d4c843	delete tableName=CLIENT_SESSION_ROLE; delete tableName=CLIENT_SESSION; delete tableName=USER_SESSION; createTable tableName=CLIENT_ATTRIBUTES; createTable tableName=CLIENT_SESSION_NOTE; createTable tableName=APP_NODE_REGISTRATIONS; addColumn table...		\N	4.8.0	\N	\N	4040024026
1.1.0.Final	sthorger@redhat.com	META-INF/jpa-changelog-1.1.0.Final.xml	2022-09-24 17:20:24.63753	4	EXECUTED	8:80230013e961310e6872e871be424a63	renameColumn newColumnName=EVENT_TIME, oldColumnName=TIME, tableName=EVENT_ENTITY		\N	4.8.0	\N	\N	4040024026
1.2.0.Beta1	psilva@redhat.com	META-INF/jpa-changelog-1.2.0.Beta1.xml	2022-09-24 17:20:24.726978	5	EXECUTED	8:67f4c20929126adc0c8e9bf48279d244	delete tableName=CLIENT_SESSION_ROLE; delete tableName=CLIENT_SESSION_NOTE; delete tableName=CLIENT_SESSION; delete tableName=USER_SESSION; createTable tableName=PROTOCOL_MAPPER; createTable tableName=PROTOCOL_MAPPER_CONFIG; createTable tableName=...		\N	4.8.0	\N	\N	4040024026
1.2.0.Beta1	psilva@redhat.com	META-INF/db2-jpa-changelog-1.2.0.Beta1.xml	2022-09-24 17:20:24.729291	6	MARK_RAN	8:7311018b0b8179ce14628ab412bb6783	delete tableName=CLIENT_SESSION_ROLE; delete tableName=CLIENT_SESSION_NOTE; delete tableName=CLIENT_SESSION; delete tableName=USER_SESSION; createTable tableName=PROTOCOL_MAPPER; createTable tableName=PROTOCOL_MAPPER_CONFIG; createTable tableName=...		\N	4.8.0	\N	\N	4040024026
1.2.0.RC1	bburke@redhat.com	META-INF/jpa-changelog-1.2.0.CR1.xml	2022-09-24 17:20:24.80195	7	EXECUTED	8:037ba1216c3640f8785ee6b8e7c8e3c1	delete tableName=CLIENT_SESSION_ROLE; delete tableName=CLIENT_SESSION_NOTE; delete tableName=CLIENT_SESSION; delete tableName=USER_SESSION_NOTE; delete tableName=USER_SESSION; createTable tableName=MIGRATION_MODEL; createTable tableName=IDENTITY_P...		\N	4.8.0	\N	\N	4040024026
1.2.0.RC1	bburke@redhat.com	META-INF/db2-jpa-changelog-1.2.0.CR1.xml	2022-09-24 17:20:24.803908	8	MARK_RAN	8:7fe6ffe4af4df289b3157de32c624263	delete tableName=CLIENT_SESSION_ROLE; delete tableName=CLIENT_SESSION_NOTE; delete tableName=CLIENT_SESSION; delete tableName=USER_SESSION_NOTE; delete tableName=USER_SESSION; createTable tableName=MIGRATION_MODEL; createTable tableName=IDENTITY_P...		\N	4.8.0	\N	\N	4040024026
1.2.0.Final	keycloak	META-INF/jpa-changelog-1.2.0.Final.xml	2022-09-24 17:20:24.807735	9	EXECUTED	8:9c136bc3187083a98745c7d03bc8a303	update tableName=CLIENT; update tableName=CLIENT; update tableName=CLIENT		\N	4.8.0	\N	\N	4040024026
1.3.0	bburke@redhat.com	META-INF/jpa-changelog-1.3.0.xml	2022-09-24 17:20:24.875453	10	EXECUTED	8:b5f09474dca81fb56a97cf5b6553d331	delete tableName=CLIENT_SESSION_ROLE; delete tableName=CLIENT_SESSION_PROT_MAPPER; delete tableName=CLIENT_SESSION_NOTE; delete tableName=CLIENT_SESSION; delete tableName=USER_SESSION_NOTE; delete tableName=USER_SESSION; createTable tableName=ADMI...		\N	4.8.0	\N	\N	4040024026
1.4.0	bburke@redhat.com	META-INF/jpa-changelog-1.4.0.xml	2022-09-24 17:20:24.919515	11	EXECUTED	8:ca924f31bd2a3b219fdcfe78c82dacf4	delete tableName=CLIENT_SESSION_AUTH_STATUS; delete tableName=CLIENT_SESSION_ROLE; delete tableName=CLIENT_SESSION_PROT_MAPPER; delete tableName=CLIENT_SESSION_NOTE; delete tableName=CLIENT_SESSION; delete tableName=USER_SESSION_NOTE; delete table...		\N	4.8.0	\N	\N	4040024026
1.4.0	bburke@redhat.com	META-INF/db2-jpa-changelog-1.4.0.xml	2022-09-24 17:20:24.923572	12	MARK_RAN	8:8acad7483e106416bcfa6f3b824a16cd	delete tableName=CLIENT_SESSION_AUTH_STATUS; delete tableName=CLIENT_SESSION_ROLE; delete tableName=CLIENT_SESSION_PROT_MAPPER; delete tableName=CLIENT_SESSION_NOTE; delete tableName=CLIENT_SESSION; delete tableName=USER_SESSION_NOTE; delete table...		\N	4.8.0	\N	\N	4040024026
1.5.0	bburke@redhat.com	META-INF/jpa-changelog-1.5.0.xml	2022-09-24 17:20:24.938635	13	EXECUTED	8:9b1266d17f4f87c78226f5055408fd5e	delete tableName=CLIENT_SESSION_AUTH_STATUS; delete tableName=CLIENT_SESSION_ROLE; delete tableName=CLIENT_SESSION_PROT_MAPPER; delete tableName=CLIENT_SESSION_NOTE; delete tableName=CLIENT_SESSION; delete tableName=USER_SESSION_NOTE; delete table...		\N	4.8.0	\N	\N	4040024026
1.6.1_from15	mposolda@redhat.com	META-INF/jpa-changelog-1.6.1.xml	2022-09-24 17:20:24.949899	14	EXECUTED	8:d80ec4ab6dbfe573550ff72396c7e910	addColumn tableName=REALM; addColumn tableName=KEYCLOAK_ROLE; addColumn tableName=CLIENT; createTable tableName=OFFLINE_USER_SESSION; createTable tableName=OFFLINE_CLIENT_SESSION; addPrimaryKey constraintName=CONSTRAINT_OFFL_US_SES_PK2, tableName=...		\N	4.8.0	\N	\N	4040024026
1.6.1_from16-pre	mposolda@redhat.com	META-INF/jpa-changelog-1.6.1.xml	2022-09-24 17:20:24.950958	15	MARK_RAN	8:d86eb172171e7c20b9c849b584d147b2	delete tableName=OFFLINE_CLIENT_SESSION; delete tableName=OFFLINE_USER_SESSION		\N	4.8.0	\N	\N	4040024026
1.6.1_from16	mposolda@redhat.com	META-INF/jpa-changelog-1.6.1.xml	2022-09-24 17:20:24.952008	16	MARK_RAN	8:5735f46f0fa60689deb0ecdc2a0dea22	dropPrimaryKey constraintName=CONSTRAINT_OFFLINE_US_SES_PK, tableName=OFFLINE_USER_SESSION; dropPrimaryKey constraintName=CONSTRAINT_OFFLINE_CL_SES_PK, tableName=OFFLINE_CLIENT_SESSION; addColumn tableName=OFFLINE_USER_SESSION; update tableName=OF...		\N	4.8.0	\N	\N	4040024026
1.6.1	mposolda@redhat.com	META-INF/jpa-changelog-1.6.1.xml	2022-09-24 17:20:24.952931	17	EXECUTED	8:d41d8cd98f00b204e9800998ecf8427e	empty		\N	4.8.0	\N	\N	4040024026
1.7.0	bburke@redhat.com	META-INF/jpa-changelog-1.7.0.xml	2022-09-24 17:20:24.986762	18	EXECUTED	8:5c1a8fd2014ac7fc43b90a700f117b23	createTable tableName=KEYCLOAK_GROUP; createTable tableName=GROUP_ROLE_MAPPING; createTable tableName=GROUP_ATTRIBUTE; createTable tableName=USER_GROUP_MEMBERSHIP; createTable tableName=REALM_DEFAULT_GROUPS; addColumn tableName=IDENTITY_PROVIDER; ...		\N	4.8.0	\N	\N	4040024026
1.8.0	mposolda@redhat.com	META-INF/jpa-changelog-1.8.0.xml	2022-09-24 17:20:25.022539	19	EXECUTED	8:1f6c2c2dfc362aff4ed75b3f0ef6b331	addColumn tableName=IDENTITY_PROVIDER; createTable tableName=CLIENT_TEMPLATE; createTable tableName=CLIENT_TEMPLATE_ATTRIBUTES; createTable tableName=TEMPLATE_SCOPE_MAPPING; dropNotNullConstraint columnName=CLIENT_ID, tableName=PROTOCOL_MAPPER; ad...		\N	4.8.0	\N	\N	4040024026
1.8.0-2	keycloak	META-INF/jpa-changelog-1.8.0.xml	2022-09-24 17:20:25.025782	20	EXECUTED	8:dee9246280915712591f83a127665107	dropDefaultValue columnName=ALGORITHM, tableName=CREDENTIAL; update tableName=CREDENTIAL		\N	4.8.0	\N	\N	4040024026
authz-3.4.0.CR1-resource-server-pk-change-part1	glavoie@gmail.com	META-INF/jpa-changelog-authz-3.4.0.CR1.xml	2022-09-24 17:20:25.297506	45	EXECUTED	8:a164ae073c56ffdbc98a615493609a52	addColumn tableName=RESOURCE_SERVER_POLICY; addColumn tableName=RESOURCE_SERVER_RESOURCE; addColumn tableName=RESOURCE_SERVER_SCOPE		\N	4.8.0	\N	\N	4040024026
1.8.0	mposolda@redhat.com	META-INF/db2-jpa-changelog-1.8.0.xml	2022-09-24 17:20:25.027131	21	MARK_RAN	8:9eb2ee1fa8ad1c5e426421a6f8fdfa6a	addColumn tableName=IDENTITY_PROVIDER; createTable tableName=CLIENT_TEMPLATE; createTable tableName=CLIENT_TEMPLATE_ATTRIBUTES; createTable tableName=TEMPLATE_SCOPE_MAPPING; dropNotNullConstraint columnName=CLIENT_ID, tableName=PROTOCOL_MAPPER; ad...		\N	4.8.0	\N	\N	4040024026
1.8.0-2	keycloak	META-INF/db2-jpa-changelog-1.8.0.xml	2022-09-24 17:20:25.028219	22	MARK_RAN	8:dee9246280915712591f83a127665107	dropDefaultValue columnName=ALGORITHM, tableName=CREDENTIAL; update tableName=CREDENTIAL		\N	4.8.0	\N	\N	4040024026
1.9.0	mposolda@redhat.com	META-INF/jpa-changelog-1.9.0.xml	2022-09-24 17:20:25.050401	23	EXECUTED	8:d9fa18ffa355320395b86270680dd4fe	update tableName=REALM; update tableName=REALM; update tableName=REALM; update tableName=REALM; update tableName=CREDENTIAL; update tableName=CREDENTIAL; update tableName=CREDENTIAL; update tableName=REALM; update tableName=REALM; customChange; dr...		\N	4.8.0	\N	\N	4040024026
1.9.1	keycloak	META-INF/jpa-changelog-1.9.1.xml	2022-09-24 17:20:25.053678	24	EXECUTED	8:90cff506fedb06141ffc1c71c4a1214c	modifyDataType columnName=PRIVATE_KEY, tableName=REALM; modifyDataType columnName=PUBLIC_KEY, tableName=REALM; modifyDataType columnName=CERTIFICATE, tableName=REALM		\N	4.8.0	\N	\N	4040024026
1.9.1	keycloak	META-INF/db2-jpa-changelog-1.9.1.xml	2022-09-24 17:20:25.054844	25	MARK_RAN	8:11a788aed4961d6d29c427c063af828c	modifyDataType columnName=PRIVATE_KEY, tableName=REALM; modifyDataType columnName=CERTIFICATE, tableName=REALM		\N	4.8.0	\N	\N	4040024026
1.9.2	keycloak	META-INF/jpa-changelog-1.9.2.xml	2022-09-24 17:20:25.068938	26	EXECUTED	8:a4218e51e1faf380518cce2af5d39b43	createIndex indexName=IDX_USER_EMAIL, tableName=USER_ENTITY; createIndex indexName=IDX_USER_ROLE_MAPPING, tableName=USER_ROLE_MAPPING; createIndex indexName=IDX_USER_GROUP_MAPPING, tableName=USER_GROUP_MEMBERSHIP; createIndex indexName=IDX_USER_CO...		\N	4.8.0	\N	\N	4040024026
authz-2.0.0	psilva@redhat.com	META-INF/jpa-changelog-authz-2.0.0.xml	2022-09-24 17:20:25.125868	27	EXECUTED	8:d9e9a1bfaa644da9952456050f07bbdc	createTable tableName=RESOURCE_SERVER; addPrimaryKey constraintName=CONSTRAINT_FARS, tableName=RESOURCE_SERVER; addUniqueConstraint constraintName=UK_AU8TT6T700S9V50BU18WS5HA6, tableName=RESOURCE_SERVER; createTable tableName=RESOURCE_SERVER_RESOU...		\N	4.8.0	\N	\N	4040024026
authz-2.5.1	psilva@redhat.com	META-INF/jpa-changelog-authz-2.5.1.xml	2022-09-24 17:20:25.127878	28	EXECUTED	8:d1bf991a6163c0acbfe664b615314505	update tableName=RESOURCE_SERVER_POLICY		\N	4.8.0	\N	\N	4040024026
2.1.0-KEYCLOAK-5461	bburke@redhat.com	META-INF/jpa-changelog-2.1.0.xml	2022-09-24 17:20:25.162727	29	EXECUTED	8:88a743a1e87ec5e30bf603da68058a8c	createTable tableName=BROKER_LINK; createTable tableName=FED_USER_ATTRIBUTE; createTable tableName=FED_USER_CONSENT; createTable tableName=FED_USER_CONSENT_ROLE; createTable tableName=FED_USER_CONSENT_PROT_MAPPER; createTable tableName=FED_USER_CR...		\N	4.8.0	\N	\N	4040024026
2.2.0	bburke@redhat.com	META-INF/jpa-changelog-2.2.0.xml	2022-09-24 17:20:25.172404	30	EXECUTED	8:c5517863c875d325dea463d00ec26d7a	addColumn tableName=ADMIN_EVENT_ENTITY; createTable tableName=CREDENTIAL_ATTRIBUTE; createTable tableName=FED_CREDENTIAL_ATTRIBUTE; modifyDataType columnName=VALUE, tableName=CREDENTIAL; addForeignKeyConstraint baseTableName=FED_CREDENTIAL_ATTRIBU...		\N	4.8.0	\N	\N	4040024026
2.3.0	bburke@redhat.com	META-INF/jpa-changelog-2.3.0.xml	2022-09-24 17:20:25.185422	31	EXECUTED	8:ada8b4833b74a498f376d7136bc7d327	createTable tableName=FEDERATED_USER; addPrimaryKey constraintName=CONSTR_FEDERATED_USER, tableName=FEDERATED_USER; dropDefaultValue columnName=TOTP, tableName=USER_ENTITY; dropColumn columnName=TOTP, tableName=USER_ENTITY; addColumn tableName=IDE...		\N	4.8.0	\N	\N	4040024026
2.4.0	bburke@redhat.com	META-INF/jpa-changelog-2.4.0.xml	2022-09-24 17:20:25.188343	32	EXECUTED	8:b9b73c8ea7299457f99fcbb825c263ba	customChange		\N	4.8.0	\N	\N	4040024026
2.5.0	bburke@redhat.com	META-INF/jpa-changelog-2.5.0.xml	2022-09-24 17:20:25.191852	33	EXECUTED	8:07724333e625ccfcfc5adc63d57314f3	customChange; modifyDataType columnName=USER_ID, tableName=OFFLINE_USER_SESSION		\N	4.8.0	\N	\N	4040024026
2.5.0-unicode-oracle	hmlnarik@redhat.com	META-INF/jpa-changelog-2.5.0.xml	2022-09-24 17:20:25.192869	34	MARK_RAN	8:8b6fd445958882efe55deb26fc541a7b	modifyDataType columnName=DESCRIPTION, tableName=AUTHENTICATION_FLOW; modifyDataType columnName=DESCRIPTION, tableName=CLIENT_TEMPLATE; modifyDataType columnName=DESCRIPTION, tableName=RESOURCE_SERVER_POLICY; modifyDataType columnName=DESCRIPTION,...		\N	4.8.0	\N	\N	4040024026
2.5.0-unicode-other-dbs	hmlnarik@redhat.com	META-INF/jpa-changelog-2.5.0.xml	2022-09-24 17:20:25.213398	35	EXECUTED	8:29b29cfebfd12600897680147277a9d7	modifyDataType columnName=DESCRIPTION, tableName=AUTHENTICATION_FLOW; modifyDataType columnName=DESCRIPTION, tableName=CLIENT_TEMPLATE; modifyDataType columnName=DESCRIPTION, tableName=RESOURCE_SERVER_POLICY; modifyDataType columnName=DESCRIPTION,...		\N	4.8.0	\N	\N	4040024026
2.5.0-duplicate-email-support	slawomir@dabek.name	META-INF/jpa-changelog-2.5.0.xml	2022-09-24 17:20:25.216267	36	EXECUTED	8:73ad77ca8fd0410c7f9f15a471fa52bc	addColumn tableName=REALM		\N	4.8.0	\N	\N	4040024026
2.5.0-unique-group-names	hmlnarik@redhat.com	META-INF/jpa-changelog-2.5.0.xml	2022-09-24 17:20:25.218666	37	EXECUTED	8:64f27a6fdcad57f6f9153210f2ec1bdb	addUniqueConstraint constraintName=SIBLING_NAMES, tableName=KEYCLOAK_GROUP		\N	4.8.0	\N	\N	4040024026
2.5.1	bburke@redhat.com	META-INF/jpa-changelog-2.5.1.xml	2022-09-24 17:20:25.22046	38	EXECUTED	8:27180251182e6c31846c2ddab4bc5781	addColumn tableName=FED_USER_CONSENT		\N	4.8.0	\N	\N	4040024026
3.0.0	bburke@redhat.com	META-INF/jpa-changelog-3.0.0.xml	2022-09-24 17:20:25.222234	39	EXECUTED	8:d56f201bfcfa7a1413eb3e9bc02978f9	addColumn tableName=IDENTITY_PROVIDER		\N	4.8.0	\N	\N	4040024026
3.2.0-fix	keycloak	META-INF/jpa-changelog-3.2.0.xml	2022-09-24 17:20:25.223043	40	MARK_RAN	8:91f5522bf6afdc2077dfab57fbd3455c	addNotNullConstraint columnName=REALM_ID, tableName=CLIENT_INITIAL_ACCESS		\N	4.8.0	\N	\N	4040024026
3.2.0-fix-with-keycloak-5416	keycloak	META-INF/jpa-changelog-3.2.0.xml	2022-09-24 17:20:25.223929	41	MARK_RAN	8:0f01b554f256c22caeb7d8aee3a1cdc8	dropIndex indexName=IDX_CLIENT_INIT_ACC_REALM, tableName=CLIENT_INITIAL_ACCESS; addNotNullConstraint columnName=REALM_ID, tableName=CLIENT_INITIAL_ACCESS; createIndex indexName=IDX_CLIENT_INIT_ACC_REALM, tableName=CLIENT_INITIAL_ACCESS		\N	4.8.0	\N	\N	4040024026
3.2.0-fix-offline-sessions	hmlnarik	META-INF/jpa-changelog-3.2.0.xml	2022-09-24 17:20:25.227147	42	EXECUTED	8:ab91cf9cee415867ade0e2df9651a947	customChange		\N	4.8.0	\N	\N	4040024026
3.2.0-fixed	keycloak	META-INF/jpa-changelog-3.2.0.xml	2022-09-24 17:20:25.291416	43	EXECUTED	8:ceac9b1889e97d602caf373eadb0d4b7	addColumn tableName=REALM; dropPrimaryKey constraintName=CONSTRAINT_OFFL_CL_SES_PK2, tableName=OFFLINE_CLIENT_SESSION; dropColumn columnName=CLIENT_SESSION_ID, tableName=OFFLINE_CLIENT_SESSION; addPrimaryKey constraintName=CONSTRAINT_OFFL_CL_SES_P...		\N	4.8.0	\N	\N	4040024026
3.3.0	keycloak	META-INF/jpa-changelog-3.3.0.xml	2022-09-24 17:20:25.293787	44	EXECUTED	8:84b986e628fe8f7fd8fd3c275c5259f2	addColumn tableName=USER_ENTITY		\N	4.8.0	\N	\N	4040024026
authz-3.4.0.CR1-resource-server-pk-change-part2-KEYCLOAK-6095	hmlnarik@redhat.com	META-INF/jpa-changelog-authz-3.4.0.CR1.xml	2022-09-24 17:20:25.301385	46	EXECUTED	8:70a2b4f1f4bd4dbf487114bdb1810e64	customChange		\N	4.8.0	\N	\N	4040024026
authz-3.4.0.CR1-resource-server-pk-change-part3-fixed	glavoie@gmail.com	META-INF/jpa-changelog-authz-3.4.0.CR1.xml	2022-09-24 17:20:25.302368	47	MARK_RAN	8:7be68b71d2f5b94b8df2e824f2860fa2	dropIndex indexName=IDX_RES_SERV_POL_RES_SERV, tableName=RESOURCE_SERVER_POLICY; dropIndex indexName=IDX_RES_SRV_RES_RES_SRV, tableName=RESOURCE_SERVER_RESOURCE; dropIndex indexName=IDX_RES_SRV_SCOPE_RES_SRV, tableName=RESOURCE_SERVER_SCOPE		\N	4.8.0	\N	\N	4040024026
authz-3.4.0.CR1-resource-server-pk-change-part3-fixed-nodropindex	glavoie@gmail.com	META-INF/jpa-changelog-authz-3.4.0.CR1.xml	2022-09-24 17:20:25.337072	48	EXECUTED	8:bab7c631093c3861d6cf6144cd944982	addNotNullConstraint columnName=RESOURCE_SERVER_CLIENT_ID, tableName=RESOURCE_SERVER_POLICY; addNotNullConstraint columnName=RESOURCE_SERVER_CLIENT_ID, tableName=RESOURCE_SERVER_RESOURCE; addNotNullConstraint columnName=RESOURCE_SERVER_CLIENT_ID, ...		\N	4.8.0	\N	\N	4040024026
authn-3.4.0.CR1-refresh-token-max-reuse	glavoie@gmail.com	META-INF/jpa-changelog-authz-3.4.0.CR1.xml	2022-09-24 17:20:25.339469	49	EXECUTED	8:fa809ac11877d74d76fe40869916daad	addColumn tableName=REALM		\N	4.8.0	\N	\N	4040024026
3.4.0	keycloak	META-INF/jpa-changelog-3.4.0.xml	2022-09-24 17:20:25.362187	50	EXECUTED	8:fac23540a40208f5f5e326f6ceb4d291	addPrimaryKey constraintName=CONSTRAINT_REALM_DEFAULT_ROLES, tableName=REALM_DEFAULT_ROLES; addPrimaryKey constraintName=CONSTRAINT_COMPOSITE_ROLE, tableName=COMPOSITE_ROLE; addPrimaryKey constraintName=CONSTR_REALM_DEFAULT_GROUPS, tableName=REALM...		\N	4.8.0	\N	\N	4040024026
3.4.0-KEYCLOAK-5230	hmlnarik@redhat.com	META-INF/jpa-changelog-3.4.0.xml	2022-09-24 17:20:25.37575	51	EXECUTED	8:2612d1b8a97e2b5588c346e817307593	createIndex indexName=IDX_FU_ATTRIBUTE, tableName=FED_USER_ATTRIBUTE; createIndex indexName=IDX_FU_CONSENT, tableName=FED_USER_CONSENT; createIndex indexName=IDX_FU_CONSENT_RU, tableName=FED_USER_CONSENT; createIndex indexName=IDX_FU_CREDENTIAL, t...		\N	4.8.0	\N	\N	4040024026
3.4.1	psilva@redhat.com	META-INF/jpa-changelog-3.4.1.xml	2022-09-24 17:20:25.3779	52	EXECUTED	8:9842f155c5db2206c88bcb5d1046e941	modifyDataType columnName=VALUE, tableName=CLIENT_ATTRIBUTES		\N	4.8.0	\N	\N	4040024026
3.4.2	keycloak	META-INF/jpa-changelog-3.4.2.xml	2022-09-24 17:20:25.379501	53	EXECUTED	8:2e12e06e45498406db72d5b3da5bbc76	update tableName=REALM		\N	4.8.0	\N	\N	4040024026
3.4.2-KEYCLOAK-5172	mkanis@redhat.com	META-INF/jpa-changelog-3.4.2.xml	2022-09-24 17:20:25.381166	54	EXECUTED	8:33560e7c7989250c40da3abdabdc75a4	update tableName=CLIENT		\N	4.8.0	\N	\N	4040024026
4.0.0-KEYCLOAK-6335	bburke@redhat.com	META-INF/jpa-changelog-4.0.0.xml	2022-09-24 17:20:25.384349	55	EXECUTED	8:87a8d8542046817a9107c7eb9cbad1cd	createTable tableName=CLIENT_AUTH_FLOW_BINDINGS; addPrimaryKey constraintName=C_CLI_FLOW_BIND, tableName=CLIENT_AUTH_FLOW_BINDINGS		\N	4.8.0	\N	\N	4040024026
4.0.0-CLEANUP-UNUSED-TABLE	bburke@redhat.com	META-INF/jpa-changelog-4.0.0.xml	2022-09-24 17:20:25.390182	56	EXECUTED	8:3ea08490a70215ed0088c273d776311e	dropTable tableName=CLIENT_IDENTITY_PROV_MAPPING		\N	4.8.0	\N	\N	4040024026
4.0.0-KEYCLOAK-6228	bburke@redhat.com	META-INF/jpa-changelog-4.0.0.xml	2022-09-24 17:20:25.403639	57	EXECUTED	8:2d56697c8723d4592ab608ce14b6ed68	dropUniqueConstraint constraintName=UK_JKUWUVD56ONTGSUHOGM8UEWRT, tableName=USER_CONSENT; dropNotNullConstraint columnName=CLIENT_ID, tableName=USER_CONSENT; addColumn tableName=USER_CONSENT; addUniqueConstraint constraintName=UK_JKUWUVD56ONTGSUHO...		\N	4.8.0	\N	\N	4040024026
4.0.0-KEYCLOAK-5579-fixed	mposolda@redhat.com	META-INF/jpa-changelog-4.0.0.xml	2022-09-24 17:20:25.487329	58	EXECUTED	8:3e423e249f6068ea2bbe48bf907f9d86	dropForeignKeyConstraint baseTableName=CLIENT_TEMPLATE_ATTRIBUTES, constraintName=FK_CL_TEMPL_ATTR_TEMPL; renameTable newTableName=CLIENT_SCOPE_ATTRIBUTES, oldTableName=CLIENT_TEMPLATE_ATTRIBUTES; renameColumn newColumnName=SCOPE_ID, oldColumnName...		\N	4.8.0	\N	\N	4040024026
authz-4.0.0.CR1	psilva@redhat.com	META-INF/jpa-changelog-authz-4.0.0.CR1.xml	2022-09-24 17:20:25.506348	59	EXECUTED	8:15cabee5e5df0ff099510a0fc03e4103	createTable tableName=RESOURCE_SERVER_PERM_TICKET; addPrimaryKey constraintName=CONSTRAINT_FAPMT, tableName=RESOURCE_SERVER_PERM_TICKET; addForeignKeyConstraint baseTableName=RESOURCE_SERVER_PERM_TICKET, constraintName=FK_FRSRHO213XCX4WNKOG82SSPMT...		\N	4.8.0	\N	\N	4040024026
authz-4.0.0.Beta3	psilva@redhat.com	META-INF/jpa-changelog-authz-4.0.0.Beta3.xml	2022-09-24 17:20:25.510646	60	EXECUTED	8:4b80200af916ac54d2ffbfc47918ab0e	addColumn tableName=RESOURCE_SERVER_POLICY; addColumn tableName=RESOURCE_SERVER_PERM_TICKET; addForeignKeyConstraint baseTableName=RESOURCE_SERVER_PERM_TICKET, constraintName=FK_FRSRPO2128CX4WNKOG82SSRFY, referencedTableName=RESOURCE_SERVER_POLICY		\N	4.8.0	\N	\N	4040024026
authz-4.2.0.Final	mhajas@redhat.com	META-INF/jpa-changelog-authz-4.2.0.Final.xml	2022-09-24 17:20:25.517501	61	EXECUTED	8:66564cd5e168045d52252c5027485bbb	createTable tableName=RESOURCE_URIS; addForeignKeyConstraint baseTableName=RESOURCE_URIS, constraintName=FK_RESOURCE_SERVER_URIS, referencedTableName=RESOURCE_SERVER_RESOURCE; customChange; dropColumn columnName=URI, tableName=RESOURCE_SERVER_RESO...		\N	4.8.0	\N	\N	4040024026
authz-4.2.0.Final-KEYCLOAK-9944	hmlnarik@redhat.com	META-INF/jpa-changelog-authz-4.2.0.Final.xml	2022-09-24 17:20:25.519996	62	EXECUTED	8:1c7064fafb030222be2bd16ccf690f6f	addPrimaryKey constraintName=CONSTRAINT_RESOUR_URIS_PK, tableName=RESOURCE_URIS		\N	4.8.0	\N	\N	4040024026
4.2.0-KEYCLOAK-6313	wadahiro@gmail.com	META-INF/jpa-changelog-4.2.0.xml	2022-09-24 17:20:25.521895	63	EXECUTED	8:2de18a0dce10cdda5c7e65c9b719b6e5	addColumn tableName=REQUIRED_ACTION_PROVIDER		\N	4.8.0	\N	\N	4040024026
4.3.0-KEYCLOAK-7984	wadahiro@gmail.com	META-INF/jpa-changelog-4.3.0.xml	2022-09-24 17:20:25.52349	64	EXECUTED	8:03e413dd182dcbd5c57e41c34d0ef682	update tableName=REQUIRED_ACTION_PROVIDER		\N	4.8.0	\N	\N	4040024026
4.6.0-KEYCLOAK-7950	psilva@redhat.com	META-INF/jpa-changelog-4.6.0.xml	2022-09-24 17:20:25.525219	65	EXECUTED	8:d27b42bb2571c18fbe3fe4e4fb7582a7	update tableName=RESOURCE_SERVER_RESOURCE		\N	4.8.0	\N	\N	4040024026
4.6.0-KEYCLOAK-8377	keycloak	META-INF/jpa-changelog-4.6.0.xml	2022-09-24 17:20:25.532535	66	EXECUTED	8:698baf84d9fd0027e9192717c2154fb8	createTable tableName=ROLE_ATTRIBUTE; addPrimaryKey constraintName=CONSTRAINT_ROLE_ATTRIBUTE_PK, tableName=ROLE_ATTRIBUTE; addForeignKeyConstraint baseTableName=ROLE_ATTRIBUTE, constraintName=FK_ROLE_ATTRIBUTE_ID, referencedTableName=KEYCLOAK_ROLE...		\N	4.8.0	\N	\N	4040024026
4.6.0-KEYCLOAK-8555	gideonray@gmail.com	META-INF/jpa-changelog-4.6.0.xml	2022-09-24 17:20:25.534766	67	EXECUTED	8:ced8822edf0f75ef26eb51582f9a821a	createIndex indexName=IDX_COMPONENT_PROVIDER_TYPE, tableName=COMPONENT		\N	4.8.0	\N	\N	4040024026
4.7.0-KEYCLOAK-1267	sguilhen@redhat.com	META-INF/jpa-changelog-4.7.0.xml	2022-09-24 17:20:25.537609	68	EXECUTED	8:f0abba004cf429e8afc43056df06487d	addColumn tableName=REALM		\N	4.8.0	\N	\N	4040024026
4.7.0-KEYCLOAK-7275	keycloak	META-INF/jpa-changelog-4.7.0.xml	2022-09-24 17:20:25.543843	69	EXECUTED	8:6662f8b0b611caa359fcf13bf63b4e24	renameColumn newColumnName=CREATED_ON, oldColumnName=LAST_SESSION_REFRESH, tableName=OFFLINE_USER_SESSION; addNotNullConstraint columnName=CREATED_ON, tableName=OFFLINE_USER_SESSION; addColumn tableName=OFFLINE_USER_SESSION; customChange; createIn...		\N	4.8.0	\N	\N	4040024026
4.8.0-KEYCLOAK-8835	sguilhen@redhat.com	META-INF/jpa-changelog-4.8.0.xml	2022-09-24 17:20:25.547032	70	EXECUTED	8:9e6b8009560f684250bdbdf97670d39e	addNotNullConstraint columnName=SSO_MAX_LIFESPAN_REMEMBER_ME, tableName=REALM; addNotNullConstraint columnName=SSO_IDLE_TIMEOUT_REMEMBER_ME, tableName=REALM		\N	4.8.0	\N	\N	4040024026
authz-7.0.0-KEYCLOAK-10443	psilva@redhat.com	META-INF/jpa-changelog-authz-7.0.0.xml	2022-09-24 17:20:25.549022	71	EXECUTED	8:4223f561f3b8dc655846562b57bb502e	addColumn tableName=RESOURCE_SERVER		\N	4.8.0	\N	\N	4040024026
8.0.0-adding-credential-columns	keycloak	META-INF/jpa-changelog-8.0.0.xml	2022-09-24 17:20:25.553385	72	EXECUTED	8:215a31c398b363ce383a2b301202f29e	addColumn tableName=CREDENTIAL; addColumn tableName=FED_USER_CREDENTIAL		\N	4.8.0	\N	\N	4040024026
8.0.0-updating-credential-data-not-oracle-fixed	keycloak	META-INF/jpa-changelog-8.0.0.xml	2022-09-24 17:20:25.558069	73	EXECUTED	8:83f7a671792ca98b3cbd3a1a34862d3d	update tableName=CREDENTIAL; update tableName=CREDENTIAL; update tableName=CREDENTIAL; update tableName=FED_USER_CREDENTIAL; update tableName=FED_USER_CREDENTIAL; update tableName=FED_USER_CREDENTIAL		\N	4.8.0	\N	\N	4040024026
8.0.0-updating-credential-data-oracle-fixed	keycloak	META-INF/jpa-changelog-8.0.0.xml	2022-09-24 17:20:25.558918	74	MARK_RAN	8:f58ad148698cf30707a6efbdf8061aa7	update tableName=CREDENTIAL; update tableName=CREDENTIAL; update tableName=CREDENTIAL; update tableName=FED_USER_CREDENTIAL; update tableName=FED_USER_CREDENTIAL; update tableName=FED_USER_CREDENTIAL		\N	4.8.0	\N	\N	4040024026
8.0.0-credential-cleanup-fixed	keycloak	META-INF/jpa-changelog-8.0.0.xml	2022-09-24 17:20:25.578135	75	EXECUTED	8:79e4fd6c6442980e58d52ffc3ee7b19c	dropDefaultValue columnName=COUNTER, tableName=CREDENTIAL; dropDefaultValue columnName=DIGITS, tableName=CREDENTIAL; dropDefaultValue columnName=PERIOD, tableName=CREDENTIAL; dropDefaultValue columnName=ALGORITHM, tableName=CREDENTIAL; dropColumn ...		\N	4.8.0	\N	\N	4040024026
8.0.0-resource-tag-support	keycloak	META-INF/jpa-changelog-8.0.0.xml	2022-09-24 17:20:25.583328	76	EXECUTED	8:87af6a1e6d241ca4b15801d1f86a297d	addColumn tableName=MIGRATION_MODEL; createIndex indexName=IDX_UPDATE_TIME, tableName=MIGRATION_MODEL		\N	4.8.0	\N	\N	4040024026
9.0.0-always-display-client	keycloak	META-INF/jpa-changelog-9.0.0.xml	2022-09-24 17:20:25.585464	77	EXECUTED	8:b44f8d9b7b6ea455305a6d72a200ed15	addColumn tableName=CLIENT		\N	4.8.0	\N	\N	4040024026
9.0.0-drop-constraints-for-column-increase	keycloak	META-INF/jpa-changelog-9.0.0.xml	2022-09-24 17:20:25.586407	78	MARK_RAN	8:2d8ed5aaaeffd0cb004c046b4a903ac5	dropUniqueConstraint constraintName=UK_FRSR6T700S9V50BU18WS5PMT, tableName=RESOURCE_SERVER_PERM_TICKET; dropUniqueConstraint constraintName=UK_FRSR6T700S9V50BU18WS5HA6, tableName=RESOURCE_SERVER_RESOURCE; dropPrimaryKey constraintName=CONSTRAINT_O...		\N	4.8.0	\N	\N	4040024026
9.0.0-increase-column-size-federated-fk	keycloak	META-INF/jpa-changelog-9.0.0.xml	2022-09-24 17:20:25.603177	79	EXECUTED	8:e290c01fcbc275326c511633f6e2acde	modifyDataType columnName=CLIENT_ID, tableName=FED_USER_CONSENT; modifyDataType columnName=CLIENT_REALM_CONSTRAINT, tableName=KEYCLOAK_ROLE; modifyDataType columnName=OWNER, tableName=RESOURCE_SERVER_POLICY; modifyDataType columnName=CLIENT_ID, ta...		\N	4.8.0	\N	\N	4040024026
9.0.0-recreate-constraints-after-column-increase	keycloak	META-INF/jpa-changelog-9.0.0.xml	2022-09-24 17:20:25.604195	80	MARK_RAN	8:c9db8784c33cea210872ac2d805439f8	addNotNullConstraint columnName=CLIENT_ID, tableName=OFFLINE_CLIENT_SESSION; addNotNullConstraint columnName=OWNER, tableName=RESOURCE_SERVER_PERM_TICKET; addNotNullConstraint columnName=REQUESTER, tableName=RESOURCE_SERVER_PERM_TICKET; addNotNull...		\N	4.8.0	\N	\N	4040024026
9.0.1-add-index-to-client.client_id	keycloak	META-INF/jpa-changelog-9.0.1.xml	2022-09-24 17:20:25.606756	81	EXECUTED	8:95b676ce8fc546a1fcfb4c92fae4add5	createIndex indexName=IDX_CLIENT_ID, tableName=CLIENT		\N	4.8.0	\N	\N	4040024026
9.0.1-KEYCLOAK-12579-drop-constraints	keycloak	META-INF/jpa-changelog-9.0.1.xml	2022-09-24 17:20:25.60763	82	MARK_RAN	8:38a6b2a41f5651018b1aca93a41401e5	dropUniqueConstraint constraintName=SIBLING_NAMES, tableName=KEYCLOAK_GROUP		\N	4.8.0	\N	\N	4040024026
9.0.1-KEYCLOAK-12579-add-not-null-constraint	keycloak	META-INF/jpa-changelog-9.0.1.xml	2022-09-24 17:20:25.609756	83	EXECUTED	8:3fb99bcad86a0229783123ac52f7609c	addNotNullConstraint columnName=PARENT_GROUP, tableName=KEYCLOAK_GROUP		\N	4.8.0	\N	\N	4040024026
9.0.1-KEYCLOAK-12579-recreate-constraints	keycloak	META-INF/jpa-changelog-9.0.1.xml	2022-09-24 17:20:25.610629	84	MARK_RAN	8:64f27a6fdcad57f6f9153210f2ec1bdb	addUniqueConstraint constraintName=SIBLING_NAMES, tableName=KEYCLOAK_GROUP		\N	4.8.0	\N	\N	4040024026
9.0.1-add-index-to-events	keycloak	META-INF/jpa-changelog-9.0.1.xml	2022-09-24 17:20:25.612797	85	EXECUTED	8:ab4f863f39adafd4c862f7ec01890abc	createIndex indexName=IDX_EVENT_TIME, tableName=EVENT_ENTITY		\N	4.8.0	\N	\N	4040024026
map-remove-ri	keycloak	META-INF/jpa-changelog-11.0.0.xml	2022-09-24 17:20:25.61708	86	EXECUTED	8:13c419a0eb336e91ee3a3bf8fda6e2a7	dropForeignKeyConstraint baseTableName=REALM, constraintName=FK_TRAF444KK6QRKMS7N56AIWQ5Y; dropForeignKeyConstraint baseTableName=KEYCLOAK_ROLE, constraintName=FK_KJHO5LE2C0RAL09FL8CM9WFW9		\N	4.8.0	\N	\N	4040024026
map-remove-ri	keycloak	META-INF/jpa-changelog-12.0.0.xml	2022-09-24 17:20:25.626399	87	EXECUTED	8:e3fb1e698e0471487f51af1ed80fe3ac	dropForeignKeyConstraint baseTableName=REALM_DEFAULT_GROUPS, constraintName=FK_DEF_GROUPS_GROUP; dropForeignKeyConstraint baseTableName=REALM_DEFAULT_ROLES, constraintName=FK_H4WPD7W4HSOOLNI3H0SW7BTJE; dropForeignKeyConstraint baseTableName=CLIENT...		\N	4.8.0	\N	\N	4040024026
12.1.0-add-realm-localization-table	keycloak	META-INF/jpa-changelog-12.0.0.xml	2022-09-24 17:20:25.630959	88	EXECUTED	8:babadb686aab7b56562817e60bf0abd0	createTable tableName=REALM_LOCALIZATIONS; addPrimaryKey tableName=REALM_LOCALIZATIONS		\N	4.8.0	\N	\N	4040024026
default-roles	keycloak	META-INF/jpa-changelog-13.0.0.xml	2022-09-24 17:20:25.635307	89	EXECUTED	8:72d03345fda8e2f17093d08801947773	addColumn tableName=REALM; customChange		\N	4.8.0	\N	\N	4040024026
default-roles-cleanup	keycloak	META-INF/jpa-changelog-13.0.0.xml	2022-09-24 17:20:25.643582	90	EXECUTED	8:61c9233951bd96ffecd9ba75f7d978a4	dropTable tableName=REALM_DEFAULT_ROLES; dropTable tableName=CLIENT_DEFAULT_ROLES		\N	4.8.0	\N	\N	4040024026
13.0.0-KEYCLOAK-16844	keycloak	META-INF/jpa-changelog-13.0.0.xml	2022-09-24 17:20:25.646102	91	EXECUTED	8:ea82e6ad945cec250af6372767b25525	createIndex indexName=IDX_OFFLINE_USS_PRELOAD, tableName=OFFLINE_USER_SESSION		\N	4.8.0	\N	\N	4040024026
map-remove-ri-13.0.0	keycloak	META-INF/jpa-changelog-13.0.0.xml	2022-09-24 17:20:25.654622	92	EXECUTED	8:d3f4a33f41d960ddacd7e2ef30d126b3	dropForeignKeyConstraint baseTableName=DEFAULT_CLIENT_SCOPE, constraintName=FK_R_DEF_CLI_SCOPE_SCOPE; dropForeignKeyConstraint baseTableName=CLIENT_SCOPE_CLIENT, constraintName=FK_C_CLI_SCOPE_SCOPE; dropForeignKeyConstraint baseTableName=CLIENT_SC...		\N	4.8.0	\N	\N	4040024026
13.0.0-KEYCLOAK-17992-drop-constraints	keycloak	META-INF/jpa-changelog-13.0.0.xml	2022-09-24 17:20:25.655895	93	MARK_RAN	8:1284a27fbd049d65831cb6fc07c8a783	dropPrimaryKey constraintName=C_CLI_SCOPE_BIND, tableName=CLIENT_SCOPE_CLIENT; dropIndex indexName=IDX_CLSCOPE_CL, tableName=CLIENT_SCOPE_CLIENT; dropIndex indexName=IDX_CL_CLSCOPE, tableName=CLIENT_SCOPE_CLIENT		\N	4.8.0	\N	\N	4040024026
13.0.0-increase-column-size-federated	keycloak	META-INF/jpa-changelog-13.0.0.xml	2022-09-24 17:20:25.663576	94	EXECUTED	8:9d11b619db2ae27c25853b8a37cd0dea	modifyDataType columnName=CLIENT_ID, tableName=CLIENT_SCOPE_CLIENT; modifyDataType columnName=SCOPE_ID, tableName=CLIENT_SCOPE_CLIENT		\N	4.8.0	\N	\N	4040024026
13.0.0-KEYCLOAK-17992-recreate-constraints	keycloak	META-INF/jpa-changelog-13.0.0.xml	2022-09-24 17:20:25.664864	95	MARK_RAN	8:3002bb3997451bb9e8bac5c5cd8d6327	addNotNullConstraint columnName=CLIENT_ID, tableName=CLIENT_SCOPE_CLIENT; addNotNullConstraint columnName=SCOPE_ID, tableName=CLIENT_SCOPE_CLIENT; addPrimaryKey constraintName=C_CLI_SCOPE_BIND, tableName=CLIENT_SCOPE_CLIENT; createIndex indexName=...		\N	4.8.0	\N	\N	4040024026
json-string-accomodation-fixed	keycloak	META-INF/jpa-changelog-13.0.0.xml	2022-09-24 17:20:25.668808	96	EXECUTED	8:dfbee0d6237a23ef4ccbb7a4e063c163	addColumn tableName=REALM_ATTRIBUTE; update tableName=REALM_ATTRIBUTE; dropColumn columnName=VALUE, tableName=REALM_ATTRIBUTE; renameColumn newColumnName=VALUE, oldColumnName=VALUE_NEW, tableName=REALM_ATTRIBUTE		\N	4.8.0	\N	\N	4040024026
14.0.0-KEYCLOAK-11019	keycloak	META-INF/jpa-changelog-14.0.0.xml	2022-09-24 17:20:25.673881	97	EXECUTED	8:75f3e372df18d38c62734eebb986b960	createIndex indexName=IDX_OFFLINE_CSS_PRELOAD, tableName=OFFLINE_CLIENT_SESSION; createIndex indexName=IDX_OFFLINE_USS_BY_USER, tableName=OFFLINE_USER_SESSION; createIndex indexName=IDX_OFFLINE_USS_BY_USERSESS, tableName=OFFLINE_USER_SESSION		\N	4.8.0	\N	\N	4040024026
14.0.0-KEYCLOAK-18286	keycloak	META-INF/jpa-changelog-14.0.0.xml	2022-09-24 17:20:25.675066	98	MARK_RAN	8:7fee73eddf84a6035691512c85637eef	createIndex indexName=IDX_CLIENT_ATT_BY_NAME_VALUE, tableName=CLIENT_ATTRIBUTES		\N	4.8.0	\N	\N	4040024026
14.0.0-KEYCLOAK-18286-revert	keycloak	META-INF/jpa-changelog-14.0.0.xml	2022-09-24 17:20:25.685627	99	MARK_RAN	8:7a11134ab12820f999fbf3bb13c3adc8	dropIndex indexName=IDX_CLIENT_ATT_BY_NAME_VALUE, tableName=CLIENT_ATTRIBUTES		\N	4.8.0	\N	\N	4040024026
14.0.0-KEYCLOAK-18286-supported-dbs	keycloak	META-INF/jpa-changelog-14.0.0.xml	2022-09-24 17:20:25.689122	100	EXECUTED	8:c0f6eaac1f3be773ffe54cb5b8482b70	createIndex indexName=IDX_CLIENT_ATT_BY_NAME_VALUE, tableName=CLIENT_ATTRIBUTES		\N	4.8.0	\N	\N	4040024026
14.0.0-KEYCLOAK-18286-unsupported-dbs	keycloak	META-INF/jpa-changelog-14.0.0.xml	2022-09-24 17:20:25.690455	101	MARK_RAN	8:18186f0008b86e0f0f49b0c4d0e842ac	createIndex indexName=IDX_CLIENT_ATT_BY_NAME_VALUE, tableName=CLIENT_ATTRIBUTES		\N	4.8.0	\N	\N	4040024026
KEYCLOAK-17267-add-index-to-user-attributes	keycloak	META-INF/jpa-changelog-14.0.0.xml	2022-09-24 17:20:25.692968	102	EXECUTED	8:09c2780bcb23b310a7019d217dc7b433	createIndex indexName=IDX_USER_ATTRIBUTE_NAME, tableName=USER_ATTRIBUTE		\N	4.8.0	\N	\N	4040024026
KEYCLOAK-18146-add-saml-art-binding-identifier	keycloak	META-INF/jpa-changelog-14.0.0.xml	2022-09-24 17:20:25.697149	103	EXECUTED	8:276a44955eab693c970a42880197fff2	customChange		\N	4.8.0	\N	\N	4040024026
15.0.0-KEYCLOAK-18467	keycloak	META-INF/jpa-changelog-15.0.0.xml	2022-09-24 17:20:25.70134	104	EXECUTED	8:ba8ee3b694d043f2bfc1a1079d0760d7	addColumn tableName=REALM_LOCALIZATIONS; update tableName=REALM_LOCALIZATIONS; dropColumn columnName=TEXTS, tableName=REALM_LOCALIZATIONS; renameColumn newColumnName=TEXTS, oldColumnName=TEXTS_NEW, tableName=REALM_LOCALIZATIONS; addNotNullConstrai...		\N	4.8.0	\N	\N	4040024026
17.0.0-9562	keycloak	META-INF/jpa-changelog-17.0.0.xml	2022-09-24 17:20:25.703981	105	EXECUTED	8:5e06b1d75f5d17685485e610c2851b17	createIndex indexName=IDX_USER_SERVICE_ACCOUNT, tableName=USER_ENTITY		\N	4.8.0	\N	\N	4040024026
18.0.0-10625-IDX_ADMIN_EVENT_TIME	keycloak	META-INF/jpa-changelog-18.0.0.xml	2022-09-24 17:20:25.706556	106	EXECUTED	8:4b80546c1dc550ac552ee7b24a4ab7c0	createIndex indexName=IDX_ADMIN_EVENT_TIME, tableName=ADMIN_EVENT_ENTITY		\N	4.8.0	\N	\N	4040024026
19.0.0-10135	keycloak	META-INF/jpa-changelog-19.0.0.xml	2022-09-24 17:20:25.710382	107	EXECUTED	8:af510cd1bb2ab6339c45372f3e491696	customChange		\N	4.8.0	\N	\N	4040024026
\.


--
-- Data for Name: databasechangeloglock; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.databasechangeloglock (id, locked, lockgranted, lockedby) FROM stdin;
1	f	\N	\N
1000	f	\N	\N
1001	f	\N	\N
\.


--
-- Data for Name: default_client_scope; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.default_client_scope (realm_id, scope_id, default_scope) FROM stdin;
65e9a13f-13e5-431c-8500-c136a2014a70	acf0a738-9931-42c4-9b1d-9e79bf5d0542	f
65e9a13f-13e5-431c-8500-c136a2014a70	4a2871f7-b05b-45c3-b4e3-9d66c7f1c456	t
65e9a13f-13e5-431c-8500-c136a2014a70	1670ffaf-0dcc-43ab-9542-20a5d061cb70	t
65e9a13f-13e5-431c-8500-c136a2014a70	8c633ac3-01a1-4768-bf94-09d6a8eefe67	t
65e9a13f-13e5-431c-8500-c136a2014a70	8b652e2f-5418-4389-b295-db3f2db7c238	f
65e9a13f-13e5-431c-8500-c136a2014a70	47680830-c71d-4277-aa35-bd6e499b1777	f
65e9a13f-13e5-431c-8500-c136a2014a70	919a49fc-a46a-4cc4-a055-db381f8f45ab	t
65e9a13f-13e5-431c-8500-c136a2014a70	75f5e8eb-66b0-4e97-b477-c819eb979d33	t
65e9a13f-13e5-431c-8500-c136a2014a70	73f8f09a-a679-4444-9927-bf122c9ba39d	f
65e9a13f-13e5-431c-8500-c136a2014a70	28466805-58b3-44ac-a00e-3b67deb134bd	t
8ce1928e-b671-44b2-ab2f-ba0a2fc46762	1539e1f7-ffa4-4dc7-9c8b-b19d76234078	t
8ce1928e-b671-44b2-ab2f-ba0a2fc46762	376c7112-f871-403d-930f-4cc72d34a411	t
8ce1928e-b671-44b2-ab2f-ba0a2fc46762	56b9fbab-32f2-44a5-8554-7d5c116dbbde	t
8ce1928e-b671-44b2-ab2f-ba0a2fc46762	60b6f750-8b18-4e73-81e4-47df8d247e71	t
8ce1928e-b671-44b2-ab2f-ba0a2fc46762	aeeaa569-8888-4607-a030-c9f979c44f61	t
8ce1928e-b671-44b2-ab2f-ba0a2fc46762	f9307808-d664-47b2-8c29-907b86184053	t
8ce1928e-b671-44b2-ab2f-ba0a2fc46762	10e311ca-7b29-4122-b23a-ee3854f11c8a	f
8ce1928e-b671-44b2-ab2f-ba0a2fc46762	3752181d-a7af-48a4-bd1d-cd5690f3998c	f
8ce1928e-b671-44b2-ab2f-ba0a2fc46762	8761fac6-8355-47c7-9db0-a09805dbf0d5	f
8ce1928e-b671-44b2-ab2f-ba0a2fc46762	fc51ff5e-3f5c-440e-9709-2e51bbd7610d	f
\.


--
-- Data for Name: event_entity; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.event_entity (id, client_id, details_json, error, ip_address, realm_id, session_id, event_time, type, user_id) FROM stdin;
\.


--
-- Data for Name: fed_user_attribute; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.fed_user_attribute (id, name, user_id, realm_id, storage_provider_id, value) FROM stdin;
\.


--
-- Data for Name: fed_user_consent; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.fed_user_consent (id, client_id, user_id, realm_id, storage_provider_id, created_date, last_updated_date, client_storage_provider, external_client_id) FROM stdin;
\.


--
-- Data for Name: fed_user_consent_cl_scope; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.fed_user_consent_cl_scope (user_consent_id, scope_id) FROM stdin;
\.


--
-- Data for Name: fed_user_credential; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.fed_user_credential (id, salt, type, created_date, user_id, realm_id, storage_provider_id, user_label, secret_data, credential_data, priority) FROM stdin;
\.


--
-- Data for Name: fed_user_group_membership; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.fed_user_group_membership (group_id, user_id, realm_id, storage_provider_id) FROM stdin;
\.


--
-- Data for Name: fed_user_required_action; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.fed_user_required_action (required_action, user_id, realm_id, storage_provider_id) FROM stdin;
\.


--
-- Data for Name: fed_user_role_mapping; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.fed_user_role_mapping (role_id, user_id, realm_id, storage_provider_id) FROM stdin;
\.


--
-- Data for Name: federated_identity; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.federated_identity (identity_provider, realm_id, federated_user_id, federated_username, token, user_id) FROM stdin;
\.


--
-- Data for Name: federated_user; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.federated_user (id, storage_provider_id, realm_id) FROM stdin;
\.


--
-- Data for Name: group_attribute; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.group_attribute (id, name, value, group_id) FROM stdin;
\.


--
-- Data for Name: group_role_mapping; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.group_role_mapping (role_id, group_id) FROM stdin;
\.


--
-- Data for Name: identity_provider; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.identity_provider (internal_id, enabled, provider_alias, provider_id, store_token, authenticate_by_default, realm_id, add_token_role, trust_email, first_broker_login_flow_id, post_broker_login_flow_id, provider_display_name, link_only) FROM stdin;
\.


--
-- Data for Name: identity_provider_config; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.identity_provider_config (identity_provider_id, value, name) FROM stdin;
\.


--
-- Data for Name: identity_provider_mapper; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.identity_provider_mapper (id, name, idp_alias, idp_mapper_name, realm_id) FROM stdin;
\.


--
-- Data for Name: idp_mapper_config; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.idp_mapper_config (idp_mapper_id, value, name) FROM stdin;
\.


--
-- Data for Name: keycloak_group; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.keycloak_group (id, name, parent_group, realm_id) FROM stdin;
\.


--
-- Data for Name: keycloak_role; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.keycloak_role (id, client_realm_constraint, client_role, description, name, realm_id, client, realm) FROM stdin;
c3729e00-622c-4432-b7c4-30929326b88f	65e9a13f-13e5-431c-8500-c136a2014a70	f	roles	default-roles-master	65e9a13f-13e5-431c-8500-c136a2014a70	\N	\N
88d4f17e-2eb0-4b28-8ce2-7d53301ad91a	65e9a13f-13e5-431c-8500-c136a2014a70	f		admin	65e9a13f-13e5-431c-8500-c136a2014a70	\N	\N
a15967b7-68eb-432f-bb81-41e8e6790dbf	65e9a13f-13e5-431c-8500-c136a2014a70	f	realm	create-realm	65e9a13f-13e5-431c-8500-c136a2014a70	\N	\N
a597e125-acc5-451b-a6cf-b38ccbc595bb	852e20a2-bc82-4a22-bd43-3d09702452fa	t	client	create-client	65e9a13f-13e5-431c-8500-c136a2014a70	852e20a2-bc82-4a22-bd43-3d09702452fa	\N
d37ab9fb-07be-4130-9441-9b530c9fc6a9	852e20a2-bc82-4a22-bd43-3d09702452fa	t	realm	view-realm	65e9a13f-13e5-431c-8500-c136a2014a70	852e20a2-bc82-4a22-bd43-3d09702452fa	\N
fd39cd72-2cbf-4653-94e5-62d24b168818	852e20a2-bc82-4a22-bd43-3d09702452fa	t	users	view-users	65e9a13f-13e5-431c-8500-c136a2014a70	852e20a2-bc82-4a22-bd43-3d09702452fa	\N
afc835f8-6277-4f63-9173-2c5855159462	852e20a2-bc82-4a22-bd43-3d09702452fa	t	clients	view-clients	65e9a13f-13e5-431c-8500-c136a2014a70	852e20a2-bc82-4a22-bd43-3d09702452fa	\N
4da9c86d-55f6-4107-b914-20bb95a91e34	852e20a2-bc82-4a22-bd43-3d09702452fa	t	events	view-events	65e9a13f-13e5-431c-8500-c136a2014a70	852e20a2-bc82-4a22-bd43-3d09702452fa	\N
b48eb883-b7f4-4ec3-9792-6a87d5c2f525	852e20a2-bc82-4a22-bd43-3d09702452fa	t	identity-providers	view-identity-providers	65e9a13f-13e5-431c-8500-c136a2014a70	852e20a2-bc82-4a22-bd43-3d09702452fa	\N
ac080123-5ea2-49dd-9b55-582eed3a4183	852e20a2-bc82-4a22-bd43-3d09702452fa	t	authorization	view-authorization	65e9a13f-13e5-431c-8500-c136a2014a70	852e20a2-bc82-4a22-bd43-3d09702452fa	\N
f9061798-3ae6-4773-a3c6-9da30f156f2d	852e20a2-bc82-4a22-bd43-3d09702452fa	t	realm	manage-realm	65e9a13f-13e5-431c-8500-c136a2014a70	852e20a2-bc82-4a22-bd43-3d09702452fa	\N
d4dd55e4-acdb-4d98-b235-1890cd09ee2c	852e20a2-bc82-4a22-bd43-3d09702452fa	t	users	manage-users	65e9a13f-13e5-431c-8500-c136a2014a70	852e20a2-bc82-4a22-bd43-3d09702452fa	\N
4d06737e-feb5-464c-bd54-76095ab54646	852e20a2-bc82-4a22-bd43-3d09702452fa	t	clients	manage-clients	65e9a13f-13e5-431c-8500-c136a2014a70	852e20a2-bc82-4a22-bd43-3d09702452fa	\N
7125808b-4127-4d1f-b168-ddcc13dfc106	852e20a2-bc82-4a22-bd43-3d09702452fa	t	events	manage-events	65e9a13f-13e5-431c-8500-c136a2014a70	852e20a2-bc82-4a22-bd43-3d09702452fa	\N
0adfb59d-6561-4d35-9073-4326b1971e57	852e20a2-bc82-4a22-bd43-3d09702452fa	t	identity-providers	manage-identity-providers	65e9a13f-13e5-431c-8500-c136a2014a70	852e20a2-bc82-4a22-bd43-3d09702452fa	\N
fdbebaa5-eb32-4c94-b913-6a4b8c3bf64c	852e20a2-bc82-4a22-bd43-3d09702452fa	t	authorization	manage-authorization	65e9a13f-13e5-431c-8500-c136a2014a70	852e20a2-bc82-4a22-bd43-3d09702452fa	\N
5db2bbd4-caa8-4bed-bc3c-1e51d403efbc	852e20a2-bc82-4a22-bd43-3d09702452fa	t	users	query-users	65e9a13f-13e5-431c-8500-c136a2014a70	852e20a2-bc82-4a22-bd43-3d09702452fa	\N
5f997de8-76ce-4a16-ac5a-5932b3b348a4	852e20a2-bc82-4a22-bd43-3d09702452fa	t	clients	query-clients	65e9a13f-13e5-431c-8500-c136a2014a70	852e20a2-bc82-4a22-bd43-3d09702452fa	\N
1aeb92eb-b1e2-46ce-8446-db96f750465e	852e20a2-bc82-4a22-bd43-3d09702452fa	t	realms	query-realms	65e9a13f-13e5-431c-8500-c136a2014a70	852e20a2-bc82-4a22-bd43-3d09702452fa	\N
85fd2e0c-1d39-4ba6-916f-4c52cd526adb	852e20a2-bc82-4a22-bd43-3d09702452fa	t	groups	query-groups	65e9a13f-13e5-431c-8500-c136a2014a70	852e20a2-bc82-4a22-bd43-3d09702452fa	\N
0c2bdcc1-aec1-4ca6-8312-f146e266db95	e549e79e-4e77-425f-8611-8eefc4f267da	t	profile	view-profile	65e9a13f-13e5-431c-8500-c136a2014a70	e549e79e-4e77-425f-8611-8eefc4f267da	\N
6fb1586d-36cd-4b67-84d7-b3d8b6b0e468	e549e79e-4e77-425f-8611-8eefc4f267da	t	account	manage-account	65e9a13f-13e5-431c-8500-c136a2014a70	e549e79e-4e77-425f-8611-8eefc4f267da	\N
07edb37f-819f-441f-821b-7f273053bd65	e549e79e-4e77-425f-8611-8eefc4f267da	t	account-links	manage-account-links	65e9a13f-13e5-431c-8500-c136a2014a70	e549e79e-4e77-425f-8611-8eefc4f267da	\N
afd4d092-22ad-4166-9756-5bd4f176339a	e549e79e-4e77-425f-8611-8eefc4f267da	t	applications	view-applications	65e9a13f-13e5-431c-8500-c136a2014a70	e549e79e-4e77-425f-8611-8eefc4f267da	\N
16dea087-0a72-4672-9efe-f2a7c56f1b1d	e549e79e-4e77-425f-8611-8eefc4f267da	t	consent	view-consent	65e9a13f-13e5-431c-8500-c136a2014a70	e549e79e-4e77-425f-8611-8eefc4f267da	\N
97f79fea-d057-4b83-91aa-7212ae2600f9	e549e79e-4e77-425f-8611-8eefc4f267da	t	consent	manage-consent	65e9a13f-13e5-431c-8500-c136a2014a70	e549e79e-4e77-425f-8611-8eefc4f267da	\N
79821c33-1f55-466f-9f18-03ca223531fd	e549e79e-4e77-425f-8611-8eefc4f267da	t	account	delete-account	65e9a13f-13e5-431c-8500-c136a2014a70	e549e79e-4e77-425f-8611-8eefc4f267da	\N
5154d251-947b-4768-8b73-b7ed11dfc58f	26393c65-dd94-4211-8bfa-ad080c4a2726	t	token	read-token	65e9a13f-13e5-431c-8500-c136a2014a70	26393c65-dd94-4211-8bfa-ad080c4a2726	\N
c1f9a997-d404-459a-9cde-68975c2f2c9c	852e20a2-bc82-4a22-bd43-3d09702452fa	t		impersonation	65e9a13f-13e5-431c-8500-c136a2014a70	852e20a2-bc82-4a22-bd43-3d09702452fa	\N
46d240ee-9839-4dc4-b1ff-fdc1d067ce70	65e9a13f-13e5-431c-8500-c136a2014a70	f	access	offline_access	65e9a13f-13e5-431c-8500-c136a2014a70	\N	\N
4d619a87-64bd-41c8-878b-8b4d32d200dc	65e9a13f-13e5-431c-8500-c136a2014a70	f		uma_authorization	65e9a13f-13e5-431c-8500-c136a2014a70	\N	\N
e8c01625-cda6-4510-a2d6-29214855ce90	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	f	roles	default-roles-hocus	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	\N	\N
2490abeb-9550-49c9-8110-04f214defa07	7c83487d-a523-408e-ad85-666f44f21031	t	client	create-client	65e9a13f-13e5-431c-8500-c136a2014a70	7c83487d-a523-408e-ad85-666f44f21031	\N
bf37b9e5-fba0-44b7-bfb6-eda946cdabe8	7c83487d-a523-408e-ad85-666f44f21031	t	realm	view-realm	65e9a13f-13e5-431c-8500-c136a2014a70	7c83487d-a523-408e-ad85-666f44f21031	\N
24ab2cec-5293-467b-bd30-0a329f8a69be	7c83487d-a523-408e-ad85-666f44f21031	t	users	view-users	65e9a13f-13e5-431c-8500-c136a2014a70	7c83487d-a523-408e-ad85-666f44f21031	\N
8f79a5fd-3259-4a2f-ac18-627aa9cd59d0	7c83487d-a523-408e-ad85-666f44f21031	t	clients	view-clients	65e9a13f-13e5-431c-8500-c136a2014a70	7c83487d-a523-408e-ad85-666f44f21031	\N
356751dc-098d-4540-b866-27d70bc58aad	7c83487d-a523-408e-ad85-666f44f21031	t	events	view-events	65e9a13f-13e5-431c-8500-c136a2014a70	7c83487d-a523-408e-ad85-666f44f21031	\N
9862cc78-f1d1-4de2-aa33-943aa5fa3bac	7c83487d-a523-408e-ad85-666f44f21031	t	identity-providers	view-identity-providers	65e9a13f-13e5-431c-8500-c136a2014a70	7c83487d-a523-408e-ad85-666f44f21031	\N
1affecc8-f820-4195-87fb-b569670d4dbf	7c83487d-a523-408e-ad85-666f44f21031	t	authorization	view-authorization	65e9a13f-13e5-431c-8500-c136a2014a70	7c83487d-a523-408e-ad85-666f44f21031	\N
e7a3c11c-a97f-471e-8da8-6740f15aee82	7c83487d-a523-408e-ad85-666f44f21031	t	realm	manage-realm	65e9a13f-13e5-431c-8500-c136a2014a70	7c83487d-a523-408e-ad85-666f44f21031	\N
be2a5918-a320-43ba-9593-e9fb3ec9a684	7c83487d-a523-408e-ad85-666f44f21031	t	users	manage-users	65e9a13f-13e5-431c-8500-c136a2014a70	7c83487d-a523-408e-ad85-666f44f21031	\N
fb972515-64bf-49fa-b284-3e3d9d8b1f70	7c83487d-a523-408e-ad85-666f44f21031	t	clients	manage-clients	65e9a13f-13e5-431c-8500-c136a2014a70	7c83487d-a523-408e-ad85-666f44f21031	\N
dfdcef3c-58c0-4dbd-bb79-e0485735db27	7c83487d-a523-408e-ad85-666f44f21031	t	events	manage-events	65e9a13f-13e5-431c-8500-c136a2014a70	7c83487d-a523-408e-ad85-666f44f21031	\N
8a033534-b955-4485-87bb-8aad704e382b	7c83487d-a523-408e-ad85-666f44f21031	t	identity-providers	manage-identity-providers	65e9a13f-13e5-431c-8500-c136a2014a70	7c83487d-a523-408e-ad85-666f44f21031	\N
641895e2-e368-438a-ad77-c04543840c42	7c83487d-a523-408e-ad85-666f44f21031	t	authorization	manage-authorization	65e9a13f-13e5-431c-8500-c136a2014a70	7c83487d-a523-408e-ad85-666f44f21031	\N
9ff17634-c68a-4d9a-b580-d5be62df37e1	7c83487d-a523-408e-ad85-666f44f21031	t	users	query-users	65e9a13f-13e5-431c-8500-c136a2014a70	7c83487d-a523-408e-ad85-666f44f21031	\N
19f320bd-8269-46e6-b597-ab6815adbbf3	7c83487d-a523-408e-ad85-666f44f21031	t	clients	query-clients	65e9a13f-13e5-431c-8500-c136a2014a70	7c83487d-a523-408e-ad85-666f44f21031	\N
c09efdff-83aa-4093-8ba9-b6941b3e0343	7c83487d-a523-408e-ad85-666f44f21031	t	realms	query-realms	65e9a13f-13e5-431c-8500-c136a2014a70	7c83487d-a523-408e-ad85-666f44f21031	\N
eb7d41c5-fc19-4635-af6c-4aff5a4e7f05	7c83487d-a523-408e-ad85-666f44f21031	t	groups	query-groups	65e9a13f-13e5-431c-8500-c136a2014a70	7c83487d-a523-408e-ad85-666f44f21031	\N
feff0cce-4e03-43e6-96c6-decd66171a38	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	f	access	offline_access	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	\N	\N
e9517220-c13f-4441-90a6-495d5d3e384e	fecc6bc0-e452-4102-8c7c-f8364d65a61a	t	\N	manage-account	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	fecc6bc0-e452-4102-8c7c-f8364d65a61a	\N
0a774aaf-3eb8-4c1c-94e4-ee959852be09	ad5a10c6-c1c6-4f54-8b86-c0ffa7df772c	t	\N	uma_protection	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	ad5a10c6-c1c6-4f54-8b86-c0ffa7df772c	\N
20da747e-168f-405f-a92d-7ed1d53060c6	ad5a10c6-c1c6-4f54-8b86-c0ffa7df772c	t	admin	realm-admin	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	ad5a10c6-c1c6-4f54-8b86-c0ffa7df772c	\N
0cc35a9e-37d9-4970-9b63-4e173ab8223b	ad5a10c6-c1c6-4f54-8b86-c0ffa7df772c	t	client	create-client	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	ad5a10c6-c1c6-4f54-8b86-c0ffa7df772c	\N
eca1901b-02c0-4bfe-8d18-dac948248389	ad5a10c6-c1c6-4f54-8b86-c0ffa7df772c	t	realm	view-realm	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	ad5a10c6-c1c6-4f54-8b86-c0ffa7df772c	\N
9f7ea7dd-745a-454a-b4e3-40106ca04ca9	ad5a10c6-c1c6-4f54-8b86-c0ffa7df772c	t	users	view-users	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	ad5a10c6-c1c6-4f54-8b86-c0ffa7df772c	\N
15586d42-a56d-4d16-8a70-d18b78dfd79f	ad5a10c6-c1c6-4f54-8b86-c0ffa7df772c	t	clients	view-clients	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	ad5a10c6-c1c6-4f54-8b86-c0ffa7df772c	\N
6c2366a8-04ae-4af9-afda-3754fcc97360	ad5a10c6-c1c6-4f54-8b86-c0ffa7df772c	t	events	view-events	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	ad5a10c6-c1c6-4f54-8b86-c0ffa7df772c	\N
1152ffba-aba0-41f7-b01f-05a415ea6d45	ad5a10c6-c1c6-4f54-8b86-c0ffa7df772c	t	identity-providers	view-identity-providers	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	ad5a10c6-c1c6-4f54-8b86-c0ffa7df772c	\N
ac5d1940-8f22-4822-beb5-266f7fe047fe	ad5a10c6-c1c6-4f54-8b86-c0ffa7df772c	t	authorization	view-authorization	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	ad5a10c6-c1c6-4f54-8b86-c0ffa7df772c	\N
3786733d-00e6-4578-92a7-56ac6a4794e1	ad5a10c6-c1c6-4f54-8b86-c0ffa7df772c	t	realm	manage-realm	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	ad5a10c6-c1c6-4f54-8b86-c0ffa7df772c	\N
87d629ac-6864-4d30-8569-c069c1364075	ad5a10c6-c1c6-4f54-8b86-c0ffa7df772c	t	users	manage-users	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	ad5a10c6-c1c6-4f54-8b86-c0ffa7df772c	\N
fd78854c-2d52-4313-8deb-e15aca94b90a	ad5a10c6-c1c6-4f54-8b86-c0ffa7df772c	t	clients	manage-clients	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	ad5a10c6-c1c6-4f54-8b86-c0ffa7df772c	\N
ea559493-7476-4ec9-9e87-0ffc787176ca	ad5a10c6-c1c6-4f54-8b86-c0ffa7df772c	t	events	manage-events	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	ad5a10c6-c1c6-4f54-8b86-c0ffa7df772c	\N
0adecfab-3162-4eb5-add3-a58a157b1738	ad5a10c6-c1c6-4f54-8b86-c0ffa7df772c	t	identity-providers	manage-identity-providers	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	ad5a10c6-c1c6-4f54-8b86-c0ffa7df772c	\N
e75026c4-67bd-4242-8fd0-0e47157ae9cc	ad5a10c6-c1c6-4f54-8b86-c0ffa7df772c	t	authorization	manage-authorization	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	ad5a10c6-c1c6-4f54-8b86-c0ffa7df772c	\N
4e519f62-0a7e-47cd-b316-a3250dbf7da4	ad5a10c6-c1c6-4f54-8b86-c0ffa7df772c	t	users	query-users	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	ad5a10c6-c1c6-4f54-8b86-c0ffa7df772c	\N
f6d949b1-8daa-4d5c-85db-d932b519c219	ad5a10c6-c1c6-4f54-8b86-c0ffa7df772c	t	clients	query-clients	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	ad5a10c6-c1c6-4f54-8b86-c0ffa7df772c	\N
44429678-bbda-4bd7-925a-d36a70f2ee69	ad5a10c6-c1c6-4f54-8b86-c0ffa7df772c	t	realms	query-realms	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	ad5a10c6-c1c6-4f54-8b86-c0ffa7df772c	\N
b506ab77-fc49-4146-81b0-83545d6c8945	ad5a10c6-c1c6-4f54-8b86-c0ffa7df772c	t	groups	query-groups	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	ad5a10c6-c1c6-4f54-8b86-c0ffa7df772c	\N
11419487-bfd4-4ad2-9e28-c1cda8f7fcff	7c83487d-a523-408e-ad85-666f44f21031	t		impersonation	65e9a13f-13e5-431c-8500-c136a2014a70	7c83487d-a523-408e-ad85-666f44f21031	\N
04086f50-8d9d-4f9f-886c-8bce2426821b	ad5a10c6-c1c6-4f54-8b86-c0ffa7df772c	t		impersonation	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	ad5a10c6-c1c6-4f54-8b86-c0ffa7df772c	\N
c0e1fca7-7937-4f8f-948d-d3850400edbd	fecc6bc0-e452-4102-8c7c-f8364d65a61a	t	account	delete-account	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	fecc6bc0-e452-4102-8c7c-f8364d65a61a	\N
24999798-ea13-42cc-b508-051af1110258	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	f		uma_authorization	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	\N	\N
\.


--
-- Data for Name: migration_model; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.migration_model (id, version, update_time) FROM stdin;
s4phw	19.0.2	1664040025
\.


--
-- Data for Name: offline_client_session; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.offline_client_session (user_session_id, client_id, offline_flag, "timestamp", data, client_storage_provider, external_client_id) FROM stdin;
\.


--
-- Data for Name: offline_user_session; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.offline_user_session (user_session_id, user_id, realm_id, created_on, offline_flag, data, last_session_refresh) FROM stdin;
\.


--
-- Data for Name: policy_config; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.policy_config (policy_id, name, value) FROM stdin;
\.


--
-- Data for Name: protocol_mapper; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.protocol_mapper (id, name, protocol, protocol_mapper_name, client_id, client_scope_id) FROM stdin;
bd516e5f-11cc-4ab4-b7bc-ff9cfa3cc7d1	audience resolve	openid-connect	oidc-audience-resolve-mapper	3fb776f9-9b41-4997-b3b8-cff334bc72fc	\N
a89f98bc-8167-45a0-a2c3-9c22588670d1	locale	openid-connect	oidc-usermodel-attribute-mapper	e6857f1f-a8d7-4fe0-bdf8-b7dd7685d50f	\N
084022f9-0d43-4e1d-8231-0aece9e11858	role list	saml	saml-role-list-mapper	\N	4a2871f7-b05b-45c3-b4e3-9d66c7f1c456
bf5d9063-b97e-4e73-ae5c-0bf1279153cd	full name	openid-connect	oidc-full-name-mapper	\N	1670ffaf-0dcc-43ab-9542-20a5d061cb70
d07a568e-fd63-4766-8352-e54c5f187413	family name	openid-connect	oidc-usermodel-property-mapper	\N	1670ffaf-0dcc-43ab-9542-20a5d061cb70
e300bc72-0910-43d5-8a4d-4c64b988cf31	given name	openid-connect	oidc-usermodel-property-mapper	\N	1670ffaf-0dcc-43ab-9542-20a5d061cb70
86e11333-d630-4ea4-9cca-c76512119b9b	middle name	openid-connect	oidc-usermodel-attribute-mapper	\N	1670ffaf-0dcc-43ab-9542-20a5d061cb70
b75fc8c9-7cd2-4fe7-b4d9-08dcc4160a99	nickname	openid-connect	oidc-usermodel-attribute-mapper	\N	1670ffaf-0dcc-43ab-9542-20a5d061cb70
621ca0f3-1f3b-4fa0-8ac7-6930bb7bd78c	username	openid-connect	oidc-usermodel-property-mapper	\N	1670ffaf-0dcc-43ab-9542-20a5d061cb70
4d5a0960-aa17-4b0c-9911-ed9540ae1a6c	profile	openid-connect	oidc-usermodel-attribute-mapper	\N	1670ffaf-0dcc-43ab-9542-20a5d061cb70
cc6947bd-fed5-47b5-bc7c-89b0acb9be01	picture	openid-connect	oidc-usermodel-attribute-mapper	\N	1670ffaf-0dcc-43ab-9542-20a5d061cb70
3af71b3f-21bd-4e43-af52-1b199af5c02a	website	openid-connect	oidc-usermodel-attribute-mapper	\N	1670ffaf-0dcc-43ab-9542-20a5d061cb70
dbdec2eb-87e2-4ed9-9820-546d426bbcaa	gender	openid-connect	oidc-usermodel-attribute-mapper	\N	1670ffaf-0dcc-43ab-9542-20a5d061cb70
cd97308c-3f38-451e-94b1-ff32805c0ae2	birthdate	openid-connect	oidc-usermodel-attribute-mapper	\N	1670ffaf-0dcc-43ab-9542-20a5d061cb70
40a9cf01-9ec7-4d1b-8e07-e74dad4711fb	zoneinfo	openid-connect	oidc-usermodel-attribute-mapper	\N	1670ffaf-0dcc-43ab-9542-20a5d061cb70
8b32c410-ac4b-423e-94ce-e457de99c3cb	locale	openid-connect	oidc-usermodel-attribute-mapper	\N	1670ffaf-0dcc-43ab-9542-20a5d061cb70
e5a76480-af3e-4b17-b797-ee3ca8051d6c	updated at	openid-connect	oidc-usermodel-attribute-mapper	\N	1670ffaf-0dcc-43ab-9542-20a5d061cb70
7e9fe9af-8aa2-458c-81d6-b216ff7ca940	email	openid-connect	oidc-usermodel-property-mapper	\N	8c633ac3-01a1-4768-bf94-09d6a8eefe67
2073cb6e-db85-4338-a031-1c2a1bc213b1	email verified	openid-connect	oidc-usermodel-property-mapper	\N	8c633ac3-01a1-4768-bf94-09d6a8eefe67
25325232-5c30-45ed-97bc-b302111e6def	address	openid-connect	oidc-address-mapper	\N	8b652e2f-5418-4389-b295-db3f2db7c238
501c108d-8205-4d03-9712-c912a9e3d028	phone number	openid-connect	oidc-usermodel-attribute-mapper	\N	47680830-c71d-4277-aa35-bd6e499b1777
ee5f0efa-5b56-4575-8ab4-a0f983033b7f	phone number verified	openid-connect	oidc-usermodel-attribute-mapper	\N	47680830-c71d-4277-aa35-bd6e499b1777
ea3f667d-9e68-4665-9bbf-511cdcd4e181	realm roles	openid-connect	oidc-usermodel-realm-role-mapper	\N	919a49fc-a46a-4cc4-a055-db381f8f45ab
249baa07-5689-4404-9e9c-3a2fa7763474	client roles	openid-connect	oidc-usermodel-client-role-mapper	\N	919a49fc-a46a-4cc4-a055-db381f8f45ab
cb0af80b-6e94-4f6b-a903-745627abbbfa	audience resolve	openid-connect	oidc-audience-resolve-mapper	\N	919a49fc-a46a-4cc4-a055-db381f8f45ab
c8d9b42f-2879-4e69-957e-cb84b5a68799	allowed web origins	openid-connect	oidc-allowed-origins-mapper	\N	75f5e8eb-66b0-4e97-b477-c819eb979d33
975f3802-1821-4b2d-8bc4-93b9bd161541	upn	openid-connect	oidc-usermodel-property-mapper	\N	73f8f09a-a679-4444-9927-bf122c9ba39d
c14c0d0c-a054-48d6-89a3-7dd5ca74bbe3	groups	openid-connect	oidc-usermodel-realm-role-mapper	\N	73f8f09a-a679-4444-9927-bf122c9ba39d
17b4fa48-707b-442a-9047-98e1a56660ce	acr loa level	openid-connect	oidc-acr-mapper	\N	28466805-58b3-44ac-a00e-3b67deb134bd
64aae2f2-c7bb-4535-a7dc-9e31f5d510a9	email verified	openid-connect	oidc-usermodel-property-mapper	\N	f9307808-d664-47b2-8c29-907b86184053
d9f4edcc-3c00-40fd-a393-c2a39f136eb1	email	openid-connect	oidc-usermodel-property-mapper	\N	f9307808-d664-47b2-8c29-907b86184053
f96e9c13-9431-4a93-871e-2de02a615b37	groups	openid-connect	oidc-usermodel-realm-role-mapper	\N	8761fac6-8355-47c7-9db0-a09805dbf0d5
79618920-9a29-41fb-8090-32d4712ee81a	upn	openid-connect	oidc-usermodel-property-mapper	\N	8761fac6-8355-47c7-9db0-a09805dbf0d5
118d1f5d-5422-4919-92c1-bd781877a8dc	acr loa level	openid-connect	oidc-acr-mapper	\N	1539e1f7-ffa4-4dc7-9c8b-b19d76234078
85dfdd97-28cf-4df3-a19a-34f60344f9af	phone number	openid-connect	oidc-usermodel-attribute-mapper	\N	3752181d-a7af-48a4-bd1d-cd5690f3998c
757e2cd9-b9f2-400d-8028-b430ba6bc4d0	phone number verified	openid-connect	oidc-usermodel-attribute-mapper	\N	3752181d-a7af-48a4-bd1d-cd5690f3998c
4e629c73-6286-4a1d-ad17-45a1253c1662	role list	saml	saml-role-list-mapper	\N	aeeaa569-8888-4607-a030-c9f979c44f61
61da2573-b698-4ee6-887c-613da640ede9	profile	openid-connect	oidc-usermodel-attribute-mapper	\N	56b9fbab-32f2-44a5-8554-7d5c116dbbde
f0b4fabc-ab56-4c40-9358-bce0db238c9a	family name	openid-connect	oidc-usermodel-property-mapper	\N	56b9fbab-32f2-44a5-8554-7d5c116dbbde
00221002-c970-4601-9dd0-0d3479d9d2ce	birthdate	openid-connect	oidc-usermodel-attribute-mapper	\N	56b9fbab-32f2-44a5-8554-7d5c116dbbde
923523c7-d800-4e0a-aac9-ee91a3b312c6	zoneinfo	openid-connect	oidc-usermodel-attribute-mapper	\N	56b9fbab-32f2-44a5-8554-7d5c116dbbde
39241cc0-acd8-474e-b8f8-3344efe9897d	website	openid-connect	oidc-usermodel-attribute-mapper	\N	56b9fbab-32f2-44a5-8554-7d5c116dbbde
e9a2e48a-6df4-40cb-8254-82c90e4a4ab6	middle name	openid-connect	oidc-usermodel-attribute-mapper	\N	56b9fbab-32f2-44a5-8554-7d5c116dbbde
bfe59988-232b-472f-9477-55bca19f25fa	nickname	openid-connect	oidc-usermodel-attribute-mapper	\N	56b9fbab-32f2-44a5-8554-7d5c116dbbde
e5804959-8032-4114-8c11-d0a1968fdf2b	updated at	openid-connect	oidc-usermodel-attribute-mapper	\N	56b9fbab-32f2-44a5-8554-7d5c116dbbde
2ed249e5-6f3a-43e7-b538-2d8b5d875939	full name	openid-connect	oidc-full-name-mapper	\N	56b9fbab-32f2-44a5-8554-7d5c116dbbde
3a7c3c51-b5c5-4ebd-84be-a20b2edd5235	locale	openid-connect	oidc-usermodel-attribute-mapper	\N	56b9fbab-32f2-44a5-8554-7d5c116dbbde
44ee02b4-6199-4a5c-a3f8-fda6691ced33	gender	openid-connect	oidc-usermodel-attribute-mapper	\N	56b9fbab-32f2-44a5-8554-7d5c116dbbde
ec0d8a86-2ea3-4959-a07e-3a028164c064	username	openid-connect	oidc-usermodel-property-mapper	\N	56b9fbab-32f2-44a5-8554-7d5c116dbbde
8b2cca37-7707-499f-bc3d-54ad99e4695a	picture	openid-connect	oidc-usermodel-attribute-mapper	\N	56b9fbab-32f2-44a5-8554-7d5c116dbbde
b243583f-f3c2-40a7-9e12-66df219b6f2d	given name	openid-connect	oidc-usermodel-property-mapper	\N	56b9fbab-32f2-44a5-8554-7d5c116dbbde
088a070d-b7b2-4544-b884-04cf99e098dc	address	openid-connect	oidc-address-mapper	\N	fc51ff5e-3f5c-440e-9709-2e51bbd7610d
3f7e4202-cef3-49c1-88e1-ec66cb83cbdf	client roles	openid-connect	oidc-usermodel-client-role-mapper	\N	60b6f750-8b18-4e73-81e4-47df8d247e71
0b9a6052-c890-48fc-984f-2184c7ce71d3	audience resolve	openid-connect	oidc-audience-resolve-mapper	\N	60b6f750-8b18-4e73-81e4-47df8d247e71
47c2c7be-bd45-4e9a-8ac1-7e9c7358ab1b	realm roles	openid-connect	oidc-usermodel-realm-role-mapper	\N	60b6f750-8b18-4e73-81e4-47df8d247e71
1807f26d-3bdd-40c7-9ff3-108fa597761f	allowed web origins	openid-connect	oidc-allowed-origins-mapper	\N	376c7112-f871-403d-930f-4cc72d34a411
3aed8952-89c0-4e29-a0b0-1c39c47a0e7e	locale	openid-connect	oidc-usermodel-attribute-mapper	024e7161-fb12-44a1-bc21-b2d03e26d3ee	\N
3bb06d10-7e9d-4cc7-8b67-b6fe06c018a9	Client ID	openid-connect	oidc-usersessionmodel-note-mapper	ad5a10c6-c1c6-4f54-8b86-c0ffa7df772c	\N
69377f53-7a4f-4e9a-8169-9d65c3ef006a	Client Host	openid-connect	oidc-usersessionmodel-note-mapper	ad5a10c6-c1c6-4f54-8b86-c0ffa7df772c	\N
0647931a-4824-4b51-be5a-01fee1de6c25	Client IP Address	openid-connect	oidc-usersessionmodel-note-mapper	ad5a10c6-c1c6-4f54-8b86-c0ffa7df772c	\N
591a44ff-3872-4175-a806-c2b71b55a5b3	audience resolve	openid-connect	oidc-audience-resolve-mapper	a16f9d56-89da-4707-8e7b-8e351372e3d3	\N
\.


--
-- Data for Name: protocol_mapper_config; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.protocol_mapper_config (protocol_mapper_id, value, name) FROM stdin;
a89f98bc-8167-45a0-a2c3-9c22588670d1	true	userinfo.token.claim
a89f98bc-8167-45a0-a2c3-9c22588670d1	locale	user.attribute
a89f98bc-8167-45a0-a2c3-9c22588670d1	true	id.token.claim
a89f98bc-8167-45a0-a2c3-9c22588670d1	true	access.token.claim
a89f98bc-8167-45a0-a2c3-9c22588670d1	locale	claim.name
a89f98bc-8167-45a0-a2c3-9c22588670d1	String	jsonType.label
084022f9-0d43-4e1d-8231-0aece9e11858	false	single
084022f9-0d43-4e1d-8231-0aece9e11858	Basic	attribute.nameformat
084022f9-0d43-4e1d-8231-0aece9e11858	Role	attribute.name
3af71b3f-21bd-4e43-af52-1b199af5c02a	true	userinfo.token.claim
3af71b3f-21bd-4e43-af52-1b199af5c02a	website	user.attribute
3af71b3f-21bd-4e43-af52-1b199af5c02a	true	id.token.claim
3af71b3f-21bd-4e43-af52-1b199af5c02a	true	access.token.claim
3af71b3f-21bd-4e43-af52-1b199af5c02a	website	claim.name
3af71b3f-21bd-4e43-af52-1b199af5c02a	String	jsonType.label
40a9cf01-9ec7-4d1b-8e07-e74dad4711fb	true	userinfo.token.claim
40a9cf01-9ec7-4d1b-8e07-e74dad4711fb	zoneinfo	user.attribute
40a9cf01-9ec7-4d1b-8e07-e74dad4711fb	true	id.token.claim
40a9cf01-9ec7-4d1b-8e07-e74dad4711fb	true	access.token.claim
40a9cf01-9ec7-4d1b-8e07-e74dad4711fb	zoneinfo	claim.name
40a9cf01-9ec7-4d1b-8e07-e74dad4711fb	String	jsonType.label
4d5a0960-aa17-4b0c-9911-ed9540ae1a6c	true	userinfo.token.claim
4d5a0960-aa17-4b0c-9911-ed9540ae1a6c	profile	user.attribute
4d5a0960-aa17-4b0c-9911-ed9540ae1a6c	true	id.token.claim
4d5a0960-aa17-4b0c-9911-ed9540ae1a6c	true	access.token.claim
4d5a0960-aa17-4b0c-9911-ed9540ae1a6c	profile	claim.name
4d5a0960-aa17-4b0c-9911-ed9540ae1a6c	String	jsonType.label
621ca0f3-1f3b-4fa0-8ac7-6930bb7bd78c	true	userinfo.token.claim
621ca0f3-1f3b-4fa0-8ac7-6930bb7bd78c	username	user.attribute
621ca0f3-1f3b-4fa0-8ac7-6930bb7bd78c	true	id.token.claim
621ca0f3-1f3b-4fa0-8ac7-6930bb7bd78c	true	access.token.claim
621ca0f3-1f3b-4fa0-8ac7-6930bb7bd78c	preferred_username	claim.name
621ca0f3-1f3b-4fa0-8ac7-6930bb7bd78c	String	jsonType.label
86e11333-d630-4ea4-9cca-c76512119b9b	true	userinfo.token.claim
86e11333-d630-4ea4-9cca-c76512119b9b	middleName	user.attribute
86e11333-d630-4ea4-9cca-c76512119b9b	true	id.token.claim
86e11333-d630-4ea4-9cca-c76512119b9b	true	access.token.claim
86e11333-d630-4ea4-9cca-c76512119b9b	middle_name	claim.name
86e11333-d630-4ea4-9cca-c76512119b9b	String	jsonType.label
8b32c410-ac4b-423e-94ce-e457de99c3cb	true	userinfo.token.claim
8b32c410-ac4b-423e-94ce-e457de99c3cb	locale	user.attribute
8b32c410-ac4b-423e-94ce-e457de99c3cb	true	id.token.claim
8b32c410-ac4b-423e-94ce-e457de99c3cb	true	access.token.claim
8b32c410-ac4b-423e-94ce-e457de99c3cb	locale	claim.name
8b32c410-ac4b-423e-94ce-e457de99c3cb	String	jsonType.label
b75fc8c9-7cd2-4fe7-b4d9-08dcc4160a99	true	userinfo.token.claim
b75fc8c9-7cd2-4fe7-b4d9-08dcc4160a99	nickname	user.attribute
b75fc8c9-7cd2-4fe7-b4d9-08dcc4160a99	true	id.token.claim
b75fc8c9-7cd2-4fe7-b4d9-08dcc4160a99	true	access.token.claim
b75fc8c9-7cd2-4fe7-b4d9-08dcc4160a99	nickname	claim.name
b75fc8c9-7cd2-4fe7-b4d9-08dcc4160a99	String	jsonType.label
bf5d9063-b97e-4e73-ae5c-0bf1279153cd	true	userinfo.token.claim
bf5d9063-b97e-4e73-ae5c-0bf1279153cd	true	id.token.claim
bf5d9063-b97e-4e73-ae5c-0bf1279153cd	true	access.token.claim
cc6947bd-fed5-47b5-bc7c-89b0acb9be01	true	userinfo.token.claim
cc6947bd-fed5-47b5-bc7c-89b0acb9be01	picture	user.attribute
cc6947bd-fed5-47b5-bc7c-89b0acb9be01	true	id.token.claim
cc6947bd-fed5-47b5-bc7c-89b0acb9be01	true	access.token.claim
cc6947bd-fed5-47b5-bc7c-89b0acb9be01	picture	claim.name
cc6947bd-fed5-47b5-bc7c-89b0acb9be01	String	jsonType.label
cd97308c-3f38-451e-94b1-ff32805c0ae2	true	userinfo.token.claim
cd97308c-3f38-451e-94b1-ff32805c0ae2	birthdate	user.attribute
cd97308c-3f38-451e-94b1-ff32805c0ae2	true	id.token.claim
cd97308c-3f38-451e-94b1-ff32805c0ae2	true	access.token.claim
cd97308c-3f38-451e-94b1-ff32805c0ae2	birthdate	claim.name
cd97308c-3f38-451e-94b1-ff32805c0ae2	String	jsonType.label
d07a568e-fd63-4766-8352-e54c5f187413	true	userinfo.token.claim
d07a568e-fd63-4766-8352-e54c5f187413	lastName	user.attribute
d07a568e-fd63-4766-8352-e54c5f187413	true	id.token.claim
d07a568e-fd63-4766-8352-e54c5f187413	true	access.token.claim
d07a568e-fd63-4766-8352-e54c5f187413	family_name	claim.name
d07a568e-fd63-4766-8352-e54c5f187413	String	jsonType.label
dbdec2eb-87e2-4ed9-9820-546d426bbcaa	true	userinfo.token.claim
dbdec2eb-87e2-4ed9-9820-546d426bbcaa	gender	user.attribute
dbdec2eb-87e2-4ed9-9820-546d426bbcaa	true	id.token.claim
dbdec2eb-87e2-4ed9-9820-546d426bbcaa	true	access.token.claim
dbdec2eb-87e2-4ed9-9820-546d426bbcaa	gender	claim.name
dbdec2eb-87e2-4ed9-9820-546d426bbcaa	String	jsonType.label
e300bc72-0910-43d5-8a4d-4c64b988cf31	true	userinfo.token.claim
e300bc72-0910-43d5-8a4d-4c64b988cf31	firstName	user.attribute
e300bc72-0910-43d5-8a4d-4c64b988cf31	true	id.token.claim
e300bc72-0910-43d5-8a4d-4c64b988cf31	true	access.token.claim
e300bc72-0910-43d5-8a4d-4c64b988cf31	given_name	claim.name
e300bc72-0910-43d5-8a4d-4c64b988cf31	String	jsonType.label
e5a76480-af3e-4b17-b797-ee3ca8051d6c	true	userinfo.token.claim
e5a76480-af3e-4b17-b797-ee3ca8051d6c	updatedAt	user.attribute
e5a76480-af3e-4b17-b797-ee3ca8051d6c	true	id.token.claim
e5a76480-af3e-4b17-b797-ee3ca8051d6c	true	access.token.claim
e5a76480-af3e-4b17-b797-ee3ca8051d6c	updated_at	claim.name
e5a76480-af3e-4b17-b797-ee3ca8051d6c	long	jsonType.label
2073cb6e-db85-4338-a031-1c2a1bc213b1	true	userinfo.token.claim
2073cb6e-db85-4338-a031-1c2a1bc213b1	emailVerified	user.attribute
2073cb6e-db85-4338-a031-1c2a1bc213b1	true	id.token.claim
2073cb6e-db85-4338-a031-1c2a1bc213b1	true	access.token.claim
2073cb6e-db85-4338-a031-1c2a1bc213b1	email_verified	claim.name
2073cb6e-db85-4338-a031-1c2a1bc213b1	boolean	jsonType.label
7e9fe9af-8aa2-458c-81d6-b216ff7ca940	true	userinfo.token.claim
7e9fe9af-8aa2-458c-81d6-b216ff7ca940	email	user.attribute
7e9fe9af-8aa2-458c-81d6-b216ff7ca940	true	id.token.claim
7e9fe9af-8aa2-458c-81d6-b216ff7ca940	true	access.token.claim
7e9fe9af-8aa2-458c-81d6-b216ff7ca940	email	claim.name
7e9fe9af-8aa2-458c-81d6-b216ff7ca940	String	jsonType.label
25325232-5c30-45ed-97bc-b302111e6def	formatted	user.attribute.formatted
25325232-5c30-45ed-97bc-b302111e6def	country	user.attribute.country
25325232-5c30-45ed-97bc-b302111e6def	postal_code	user.attribute.postal_code
25325232-5c30-45ed-97bc-b302111e6def	true	userinfo.token.claim
25325232-5c30-45ed-97bc-b302111e6def	street	user.attribute.street
25325232-5c30-45ed-97bc-b302111e6def	true	id.token.claim
25325232-5c30-45ed-97bc-b302111e6def	region	user.attribute.region
25325232-5c30-45ed-97bc-b302111e6def	true	access.token.claim
25325232-5c30-45ed-97bc-b302111e6def	locality	user.attribute.locality
501c108d-8205-4d03-9712-c912a9e3d028	true	userinfo.token.claim
501c108d-8205-4d03-9712-c912a9e3d028	phoneNumber	user.attribute
501c108d-8205-4d03-9712-c912a9e3d028	true	id.token.claim
501c108d-8205-4d03-9712-c912a9e3d028	true	access.token.claim
501c108d-8205-4d03-9712-c912a9e3d028	phone_number	claim.name
501c108d-8205-4d03-9712-c912a9e3d028	String	jsonType.label
ee5f0efa-5b56-4575-8ab4-a0f983033b7f	true	userinfo.token.claim
ee5f0efa-5b56-4575-8ab4-a0f983033b7f	phoneNumberVerified	user.attribute
ee5f0efa-5b56-4575-8ab4-a0f983033b7f	true	id.token.claim
ee5f0efa-5b56-4575-8ab4-a0f983033b7f	true	access.token.claim
ee5f0efa-5b56-4575-8ab4-a0f983033b7f	phone_number_verified	claim.name
ee5f0efa-5b56-4575-8ab4-a0f983033b7f	boolean	jsonType.label
249baa07-5689-4404-9e9c-3a2fa7763474	true	multivalued
249baa07-5689-4404-9e9c-3a2fa7763474	foo	user.attribute
249baa07-5689-4404-9e9c-3a2fa7763474	true	access.token.claim
249baa07-5689-4404-9e9c-3a2fa7763474	resource_access..roles	claim.name
249baa07-5689-4404-9e9c-3a2fa7763474	String	jsonType.label
ea3f667d-9e68-4665-9bbf-511cdcd4e181	true	multivalued
ea3f667d-9e68-4665-9bbf-511cdcd4e181	foo	user.attribute
ea3f667d-9e68-4665-9bbf-511cdcd4e181	true	access.token.claim
ea3f667d-9e68-4665-9bbf-511cdcd4e181	realm_access.roles	claim.name
ea3f667d-9e68-4665-9bbf-511cdcd4e181	String	jsonType.label
975f3802-1821-4b2d-8bc4-93b9bd161541	true	userinfo.token.claim
975f3802-1821-4b2d-8bc4-93b9bd161541	username	user.attribute
975f3802-1821-4b2d-8bc4-93b9bd161541	true	id.token.claim
975f3802-1821-4b2d-8bc4-93b9bd161541	true	access.token.claim
975f3802-1821-4b2d-8bc4-93b9bd161541	upn	claim.name
975f3802-1821-4b2d-8bc4-93b9bd161541	String	jsonType.label
c14c0d0c-a054-48d6-89a3-7dd5ca74bbe3	true	multivalued
c14c0d0c-a054-48d6-89a3-7dd5ca74bbe3	foo	user.attribute
c14c0d0c-a054-48d6-89a3-7dd5ca74bbe3	true	id.token.claim
c14c0d0c-a054-48d6-89a3-7dd5ca74bbe3	true	access.token.claim
c14c0d0c-a054-48d6-89a3-7dd5ca74bbe3	groups	claim.name
c14c0d0c-a054-48d6-89a3-7dd5ca74bbe3	String	jsonType.label
17b4fa48-707b-442a-9047-98e1a56660ce	true	id.token.claim
17b4fa48-707b-442a-9047-98e1a56660ce	true	access.token.claim
64aae2f2-c7bb-4535-a7dc-9e31f5d510a9	true	userinfo.token.claim
64aae2f2-c7bb-4535-a7dc-9e31f5d510a9	emailVerified	user.attribute
64aae2f2-c7bb-4535-a7dc-9e31f5d510a9	true	id.token.claim
64aae2f2-c7bb-4535-a7dc-9e31f5d510a9	true	access.token.claim
64aae2f2-c7bb-4535-a7dc-9e31f5d510a9	email_verified	claim.name
64aae2f2-c7bb-4535-a7dc-9e31f5d510a9	boolean	jsonType.label
d9f4edcc-3c00-40fd-a393-c2a39f136eb1	true	userinfo.token.claim
d9f4edcc-3c00-40fd-a393-c2a39f136eb1	email	user.attribute
d9f4edcc-3c00-40fd-a393-c2a39f136eb1	true	id.token.claim
d9f4edcc-3c00-40fd-a393-c2a39f136eb1	true	access.token.claim
d9f4edcc-3c00-40fd-a393-c2a39f136eb1	email	claim.name
d9f4edcc-3c00-40fd-a393-c2a39f136eb1	String	jsonType.label
79618920-9a29-41fb-8090-32d4712ee81a	true	userinfo.token.claim
79618920-9a29-41fb-8090-32d4712ee81a	username	user.attribute
79618920-9a29-41fb-8090-32d4712ee81a	true	id.token.claim
79618920-9a29-41fb-8090-32d4712ee81a	true	access.token.claim
79618920-9a29-41fb-8090-32d4712ee81a	upn	claim.name
79618920-9a29-41fb-8090-32d4712ee81a	String	jsonType.label
f96e9c13-9431-4a93-871e-2de02a615b37	true	multivalued
f96e9c13-9431-4a93-871e-2de02a615b37	true	userinfo.token.claim
f96e9c13-9431-4a93-871e-2de02a615b37	foo	user.attribute
f96e9c13-9431-4a93-871e-2de02a615b37	true	id.token.claim
f96e9c13-9431-4a93-871e-2de02a615b37	true	access.token.claim
f96e9c13-9431-4a93-871e-2de02a615b37	groups	claim.name
f96e9c13-9431-4a93-871e-2de02a615b37	String	jsonType.label
118d1f5d-5422-4919-92c1-bd781877a8dc	true	id.token.claim
118d1f5d-5422-4919-92c1-bd781877a8dc	true	access.token.claim
118d1f5d-5422-4919-92c1-bd781877a8dc	true	userinfo.token.claim
757e2cd9-b9f2-400d-8028-b430ba6bc4d0	true	userinfo.token.claim
757e2cd9-b9f2-400d-8028-b430ba6bc4d0	phoneNumberVerified	user.attribute
757e2cd9-b9f2-400d-8028-b430ba6bc4d0	true	id.token.claim
757e2cd9-b9f2-400d-8028-b430ba6bc4d0	true	access.token.claim
757e2cd9-b9f2-400d-8028-b430ba6bc4d0	phone_number_verified	claim.name
757e2cd9-b9f2-400d-8028-b430ba6bc4d0	boolean	jsonType.label
85dfdd97-28cf-4df3-a19a-34f60344f9af	true	userinfo.token.claim
85dfdd97-28cf-4df3-a19a-34f60344f9af	phoneNumber	user.attribute
85dfdd97-28cf-4df3-a19a-34f60344f9af	true	id.token.claim
85dfdd97-28cf-4df3-a19a-34f60344f9af	true	access.token.claim
85dfdd97-28cf-4df3-a19a-34f60344f9af	phone_number	claim.name
85dfdd97-28cf-4df3-a19a-34f60344f9af	String	jsonType.label
4e629c73-6286-4a1d-ad17-45a1253c1662	false	single
4e629c73-6286-4a1d-ad17-45a1253c1662	Basic	attribute.nameformat
4e629c73-6286-4a1d-ad17-45a1253c1662	Role	attribute.name
00221002-c970-4601-9dd0-0d3479d9d2ce	true	userinfo.token.claim
00221002-c970-4601-9dd0-0d3479d9d2ce	birthdate	user.attribute
00221002-c970-4601-9dd0-0d3479d9d2ce	true	id.token.claim
00221002-c970-4601-9dd0-0d3479d9d2ce	true	access.token.claim
00221002-c970-4601-9dd0-0d3479d9d2ce	birthdate	claim.name
00221002-c970-4601-9dd0-0d3479d9d2ce	String	jsonType.label
2ed249e5-6f3a-43e7-b538-2d8b5d875939	true	id.token.claim
2ed249e5-6f3a-43e7-b538-2d8b5d875939	true	access.token.claim
2ed249e5-6f3a-43e7-b538-2d8b5d875939	true	userinfo.token.claim
39241cc0-acd8-474e-b8f8-3344efe9897d	true	userinfo.token.claim
39241cc0-acd8-474e-b8f8-3344efe9897d	website	user.attribute
39241cc0-acd8-474e-b8f8-3344efe9897d	true	id.token.claim
39241cc0-acd8-474e-b8f8-3344efe9897d	true	access.token.claim
39241cc0-acd8-474e-b8f8-3344efe9897d	website	claim.name
39241cc0-acd8-474e-b8f8-3344efe9897d	String	jsonType.label
3a7c3c51-b5c5-4ebd-84be-a20b2edd5235	true	userinfo.token.claim
3a7c3c51-b5c5-4ebd-84be-a20b2edd5235	locale	user.attribute
3a7c3c51-b5c5-4ebd-84be-a20b2edd5235	true	id.token.claim
3a7c3c51-b5c5-4ebd-84be-a20b2edd5235	true	access.token.claim
3a7c3c51-b5c5-4ebd-84be-a20b2edd5235	locale	claim.name
3a7c3c51-b5c5-4ebd-84be-a20b2edd5235	String	jsonType.label
44ee02b4-6199-4a5c-a3f8-fda6691ced33	true	userinfo.token.claim
44ee02b4-6199-4a5c-a3f8-fda6691ced33	gender	user.attribute
44ee02b4-6199-4a5c-a3f8-fda6691ced33	true	id.token.claim
44ee02b4-6199-4a5c-a3f8-fda6691ced33	true	access.token.claim
44ee02b4-6199-4a5c-a3f8-fda6691ced33	gender	claim.name
44ee02b4-6199-4a5c-a3f8-fda6691ced33	String	jsonType.label
61da2573-b698-4ee6-887c-613da640ede9	true	userinfo.token.claim
61da2573-b698-4ee6-887c-613da640ede9	profile	user.attribute
61da2573-b698-4ee6-887c-613da640ede9	true	id.token.claim
61da2573-b698-4ee6-887c-613da640ede9	true	access.token.claim
61da2573-b698-4ee6-887c-613da640ede9	profile	claim.name
61da2573-b698-4ee6-887c-613da640ede9	String	jsonType.label
8b2cca37-7707-499f-bc3d-54ad99e4695a	true	userinfo.token.claim
8b2cca37-7707-499f-bc3d-54ad99e4695a	picture	user.attribute
8b2cca37-7707-499f-bc3d-54ad99e4695a	true	id.token.claim
8b2cca37-7707-499f-bc3d-54ad99e4695a	true	access.token.claim
8b2cca37-7707-499f-bc3d-54ad99e4695a	picture	claim.name
8b2cca37-7707-499f-bc3d-54ad99e4695a	String	jsonType.label
923523c7-d800-4e0a-aac9-ee91a3b312c6	true	userinfo.token.claim
923523c7-d800-4e0a-aac9-ee91a3b312c6	zoneinfo	user.attribute
923523c7-d800-4e0a-aac9-ee91a3b312c6	true	id.token.claim
923523c7-d800-4e0a-aac9-ee91a3b312c6	true	access.token.claim
923523c7-d800-4e0a-aac9-ee91a3b312c6	zoneinfo	claim.name
923523c7-d800-4e0a-aac9-ee91a3b312c6	String	jsonType.label
b243583f-f3c2-40a7-9e12-66df219b6f2d	true	userinfo.token.claim
b243583f-f3c2-40a7-9e12-66df219b6f2d	firstName	user.attribute
b243583f-f3c2-40a7-9e12-66df219b6f2d	true	id.token.claim
b243583f-f3c2-40a7-9e12-66df219b6f2d	true	access.token.claim
b243583f-f3c2-40a7-9e12-66df219b6f2d	given_name	claim.name
b243583f-f3c2-40a7-9e12-66df219b6f2d	String	jsonType.label
bfe59988-232b-472f-9477-55bca19f25fa	true	userinfo.token.claim
bfe59988-232b-472f-9477-55bca19f25fa	nickname	user.attribute
bfe59988-232b-472f-9477-55bca19f25fa	true	id.token.claim
bfe59988-232b-472f-9477-55bca19f25fa	true	access.token.claim
bfe59988-232b-472f-9477-55bca19f25fa	nickname	claim.name
bfe59988-232b-472f-9477-55bca19f25fa	String	jsonType.label
e5804959-8032-4114-8c11-d0a1968fdf2b	true	userinfo.token.claim
e5804959-8032-4114-8c11-d0a1968fdf2b	updatedAt	user.attribute
e5804959-8032-4114-8c11-d0a1968fdf2b	true	id.token.claim
e5804959-8032-4114-8c11-d0a1968fdf2b	true	access.token.claim
e5804959-8032-4114-8c11-d0a1968fdf2b	updated_at	claim.name
e5804959-8032-4114-8c11-d0a1968fdf2b	long	jsonType.label
e9a2e48a-6df4-40cb-8254-82c90e4a4ab6	true	userinfo.token.claim
e9a2e48a-6df4-40cb-8254-82c90e4a4ab6	middleName	user.attribute
e9a2e48a-6df4-40cb-8254-82c90e4a4ab6	true	id.token.claim
e9a2e48a-6df4-40cb-8254-82c90e4a4ab6	true	access.token.claim
e9a2e48a-6df4-40cb-8254-82c90e4a4ab6	middle_name	claim.name
e9a2e48a-6df4-40cb-8254-82c90e4a4ab6	String	jsonType.label
ec0d8a86-2ea3-4959-a07e-3a028164c064	true	userinfo.token.claim
ec0d8a86-2ea3-4959-a07e-3a028164c064	username	user.attribute
ec0d8a86-2ea3-4959-a07e-3a028164c064	true	id.token.claim
ec0d8a86-2ea3-4959-a07e-3a028164c064	true	access.token.claim
ec0d8a86-2ea3-4959-a07e-3a028164c064	preferred_username	claim.name
ec0d8a86-2ea3-4959-a07e-3a028164c064	String	jsonType.label
f0b4fabc-ab56-4c40-9358-bce0db238c9a	true	userinfo.token.claim
f0b4fabc-ab56-4c40-9358-bce0db238c9a	lastName	user.attribute
f0b4fabc-ab56-4c40-9358-bce0db238c9a	true	id.token.claim
f0b4fabc-ab56-4c40-9358-bce0db238c9a	true	access.token.claim
f0b4fabc-ab56-4c40-9358-bce0db238c9a	family_name	claim.name
f0b4fabc-ab56-4c40-9358-bce0db238c9a	String	jsonType.label
088a070d-b7b2-4544-b884-04cf99e098dc	formatted	user.attribute.formatted
088a070d-b7b2-4544-b884-04cf99e098dc	country	user.attribute.country
088a070d-b7b2-4544-b884-04cf99e098dc	postal_code	user.attribute.postal_code
088a070d-b7b2-4544-b884-04cf99e098dc	true	userinfo.token.claim
088a070d-b7b2-4544-b884-04cf99e098dc	street	user.attribute.street
088a070d-b7b2-4544-b884-04cf99e098dc	true	id.token.claim
088a070d-b7b2-4544-b884-04cf99e098dc	region	user.attribute.region
088a070d-b7b2-4544-b884-04cf99e098dc	true	access.token.claim
088a070d-b7b2-4544-b884-04cf99e098dc	locality	user.attribute.locality
3f7e4202-cef3-49c1-88e1-ec66cb83cbdf	foo	user.attribute
3f7e4202-cef3-49c1-88e1-ec66cb83cbdf	true	access.token.claim
3f7e4202-cef3-49c1-88e1-ec66cb83cbdf	resource_access..roles	claim.name
3f7e4202-cef3-49c1-88e1-ec66cb83cbdf	String	jsonType.label
3f7e4202-cef3-49c1-88e1-ec66cb83cbdf	true	multivalued
47c2c7be-bd45-4e9a-8ac1-7e9c7358ab1b	foo	user.attribute
47c2c7be-bd45-4e9a-8ac1-7e9c7358ab1b	true	access.token.claim
47c2c7be-bd45-4e9a-8ac1-7e9c7358ab1b	realm_access.roles	claim.name
47c2c7be-bd45-4e9a-8ac1-7e9c7358ab1b	String	jsonType.label
47c2c7be-bd45-4e9a-8ac1-7e9c7358ab1b	true	multivalued
3aed8952-89c0-4e29-a0b0-1c39c47a0e7e	true	userinfo.token.claim
3aed8952-89c0-4e29-a0b0-1c39c47a0e7e	locale	user.attribute
3aed8952-89c0-4e29-a0b0-1c39c47a0e7e	true	id.token.claim
3aed8952-89c0-4e29-a0b0-1c39c47a0e7e	true	access.token.claim
3aed8952-89c0-4e29-a0b0-1c39c47a0e7e	locale	claim.name
3aed8952-89c0-4e29-a0b0-1c39c47a0e7e	String	jsonType.label
0647931a-4824-4b51-be5a-01fee1de6c25	clientAddress	user.session.note
0647931a-4824-4b51-be5a-01fee1de6c25	true	id.token.claim
0647931a-4824-4b51-be5a-01fee1de6c25	true	access.token.claim
0647931a-4824-4b51-be5a-01fee1de6c25	clientAddress	claim.name
0647931a-4824-4b51-be5a-01fee1de6c25	String	jsonType.label
3bb06d10-7e9d-4cc7-8b67-b6fe06c018a9	clientId	user.session.note
3bb06d10-7e9d-4cc7-8b67-b6fe06c018a9	true	id.token.claim
3bb06d10-7e9d-4cc7-8b67-b6fe06c018a9	true	access.token.claim
3bb06d10-7e9d-4cc7-8b67-b6fe06c018a9	clientId	claim.name
3bb06d10-7e9d-4cc7-8b67-b6fe06c018a9	String	jsonType.label
69377f53-7a4f-4e9a-8169-9d65c3ef006a	clientHost	user.session.note
69377f53-7a4f-4e9a-8169-9d65c3ef006a	true	id.token.claim
69377f53-7a4f-4e9a-8169-9d65c3ef006a	true	access.token.claim
69377f53-7a4f-4e9a-8169-9d65c3ef006a	clientHost	claim.name
69377f53-7a4f-4e9a-8169-9d65c3ef006a	String	jsonType.label
\.


--
-- Data for Name: realm; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.realm (id, access_code_lifespan, user_action_lifespan, access_token_lifespan, account_theme, admin_theme, email_theme, enabled, events_enabled, events_expiration, login_theme, name, not_before, password_policy, registration_allowed, remember_me, reset_password_allowed, social, ssl_required, sso_idle_timeout, sso_max_lifespan, update_profile_on_soc_login, verify_email, master_admin_client, login_lifespan, internationalization_enabled, default_locale, reg_email_as_username, admin_events_enabled, admin_events_details_enabled, edit_username_allowed, otp_policy_counter, otp_policy_window, otp_policy_period, otp_policy_digits, otp_policy_alg, otp_policy_type, browser_flow, registration_flow, direct_grant_flow, reset_credentials_flow, client_auth_flow, offline_session_idle_timeout, revoke_refresh_token, access_token_life_implicit, login_with_email_allowed, duplicate_emails_allowed, docker_auth_flow, refresh_token_max_reuse, allow_user_managed_access, sso_max_lifespan_remember_me, sso_idle_timeout_remember_me, default_role) FROM stdin;
65e9a13f-13e5-431c-8500-c136a2014a70	60	300	60	\N	\N	\N	t	f	0	\N	master	0	\N	f	f	f	f	EXTERNAL	1800	36000	f	f	852e20a2-bc82-4a22-bd43-3d09702452fa	1800	f	\N	f	f	f	f	0	1	30	6	HmacSHA1	totp	fe605ee4-a865-4142-8ad5-2ff12a1816d1	89e71be5-0fce-4c06-a542-6b6f8952444d	04e8e7ab-6450-4440-9a6f-6e0edafe5589	3c8babf4-e626-45a8-9fa2-35c503e7a05b	7bcb46cd-c5c1-4f5b-8333-82449cfa5b13	2592000	f	900	t	f	9f04ad5f-f308-4f56-82ac-2e96fc0aa0bb	0	f	0	0	c3729e00-622c-4432-b7c4-30929326b88f
8ce1928e-b671-44b2-ab2f-ba0a2fc46762	60	300	300				t	f	0	keycloak	hocus	0	\N	t	f	f	f	EXTERNAL	1800	36000	f	f	7c83487d-a523-408e-ad85-666f44f21031	1800	f	\N	f	f	f	f	0	1	30	6	HmacSHA1	totp	6b950abd-0602-4993-9837-c2a4e0d72f35	d9619104-b36e-46f2-bc36-92d2cd74fbd4	77c83491-af58-412d-97eb-1490ae30a233	9badc312-6bac-4212-a42a-26b329c8d75b	3fe1323e-b3b4-43a0-b8c8-b084d05b3c39	2592000	f	900	t	f	4034bbd9-d9b2-4ea7-a860-4da8a1dac0ee	0	f	0	0	e8c01625-cda6-4510-a2d6-29214855ce90
\.


--
-- Data for Name: realm_attribute; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.realm_attribute (name, realm_id, value) FROM stdin;
_browser_header.contentSecurityPolicyReportOnly	65e9a13f-13e5-431c-8500-c136a2014a70	
_browser_header.xContentTypeOptions	65e9a13f-13e5-431c-8500-c136a2014a70	nosniff
_browser_header.xRobotsTag	65e9a13f-13e5-431c-8500-c136a2014a70	none
_browser_header.xFrameOptions	65e9a13f-13e5-431c-8500-c136a2014a70	SAMEORIGIN
_browser_header.contentSecurityPolicy	65e9a13f-13e5-431c-8500-c136a2014a70	frame-src 'self'; frame-ancestors 'self'; object-src 'none';
_browser_header.xXSSProtection	65e9a13f-13e5-431c-8500-c136a2014a70	1; mode=block
_browser_header.strictTransportSecurity	65e9a13f-13e5-431c-8500-c136a2014a70	max-age=31536000; includeSubDomains
bruteForceProtected	65e9a13f-13e5-431c-8500-c136a2014a70	false
permanentLockout	65e9a13f-13e5-431c-8500-c136a2014a70	false
maxFailureWaitSeconds	65e9a13f-13e5-431c-8500-c136a2014a70	900
minimumQuickLoginWaitSeconds	65e9a13f-13e5-431c-8500-c136a2014a70	60
waitIncrementSeconds	65e9a13f-13e5-431c-8500-c136a2014a70	60
quickLoginCheckMilliSeconds	65e9a13f-13e5-431c-8500-c136a2014a70	1000
maxDeltaTimeSeconds	65e9a13f-13e5-431c-8500-c136a2014a70	43200
failureFactor	65e9a13f-13e5-431c-8500-c136a2014a70	30
displayName	65e9a13f-13e5-431c-8500-c136a2014a70	Keycloak
displayNameHtml	65e9a13f-13e5-431c-8500-c136a2014a70	<div class="kc-logo-text"><span>Keycloak</span></div>
defaultSignatureAlgorithm	65e9a13f-13e5-431c-8500-c136a2014a70	RS256
offlineSessionMaxLifespanEnabled	65e9a13f-13e5-431c-8500-c136a2014a70	false
offlineSessionMaxLifespan	65e9a13f-13e5-431c-8500-c136a2014a70	5184000
clientSessionIdleTimeout	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	0
clientSessionMaxLifespan	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	0
clientOfflineSessionIdleTimeout	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	0
clientOfflineSessionMaxLifespan	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	0
oauth2DeviceCodeLifespan	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	600
oauth2DevicePollingInterval	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	5
cibaBackchannelTokenDeliveryMode	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	poll
cibaExpiresIn	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	120
cibaInterval	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	5
cibaAuthRequestedUserHint	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	login_hint
parRequestUriLifespan	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	60
bruteForceProtected	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	false
permanentLockout	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	false
maxFailureWaitSeconds	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	900
minimumQuickLoginWaitSeconds	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	60
waitIncrementSeconds	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	60
quickLoginCheckMilliSeconds	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	1000
maxDeltaTimeSeconds	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	43200
failureFactor	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	30
actionTokenGeneratedByAdminLifespan	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	43200
actionTokenGeneratedByUserLifespan	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	300
defaultSignatureAlgorithm	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	RS256
offlineSessionMaxLifespanEnabled	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	false
offlineSessionMaxLifespan	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	5184000
webAuthnPolicyRpEntityName	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	keycloak
webAuthnPolicySignatureAlgorithms	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	ES256
webAuthnPolicyRpId	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	
webAuthnPolicyAttestationConveyancePreference	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	not specified
webAuthnPolicyAuthenticatorAttachment	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	not specified
webAuthnPolicyRequireResidentKey	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	not specified
webAuthnPolicyUserVerificationRequirement	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	not specified
webAuthnPolicyCreateTimeout	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	0
webAuthnPolicyAvoidSameAuthenticatorRegister	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	false
webAuthnPolicyRpEntityNamePasswordless	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	keycloak
webAuthnPolicySignatureAlgorithmsPasswordless	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	ES256
webAuthnPolicyRpIdPasswordless	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	
webAuthnPolicyAttestationConveyancePreferencePasswordless	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	not specified
webAuthnPolicyAuthenticatorAttachmentPasswordless	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	not specified
webAuthnPolicyRequireResidentKeyPasswordless	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	not specified
webAuthnPolicyUserVerificationRequirementPasswordless	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	not specified
webAuthnPolicyCreateTimeoutPasswordless	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	0
webAuthnPolicyAvoidSameAuthenticatorRegisterPasswordless	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	false
client-policies.profiles	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	{"profiles":[]}
client-policies.policies	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	{"policies":[]}
_browser_header.contentSecurityPolicyReportOnly	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	
_browser_header.xContentTypeOptions	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	nosniff
_browser_header.xRobotsTag	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	none
_browser_header.xFrameOptions	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	SAMEORIGIN
_browser_header.contentSecurityPolicy	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	frame-src 'self'; frame-ancestors 'self'; object-src 'none';
_browser_header.xXSSProtection	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	1; mode=block
_browser_header.strictTransportSecurity	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	max-age=31536000; includeSubDomains
\.


--
-- Data for Name: realm_default_groups; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.realm_default_groups (realm_id, group_id) FROM stdin;
\.


--
-- Data for Name: realm_enabled_event_types; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.realm_enabled_event_types (realm_id, value) FROM stdin;
\.


--
-- Data for Name: realm_events_listeners; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.realm_events_listeners (realm_id, value) FROM stdin;
65e9a13f-13e5-431c-8500-c136a2014a70	jboss-logging
8ce1928e-b671-44b2-ab2f-ba0a2fc46762	jboss-logging
\.


--
-- Data for Name: realm_localizations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.realm_localizations (realm_id, locale, texts) FROM stdin;
\.


--
-- Data for Name: realm_required_credential; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.realm_required_credential (type, form_label, input, secret, realm_id) FROM stdin;
password	password	t	t	65e9a13f-13e5-431c-8500-c136a2014a70
password	password	t	t	8ce1928e-b671-44b2-ab2f-ba0a2fc46762
\.


--
-- Data for Name: realm_smtp_config; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.realm_smtp_config (realm_id, value, name) FROM stdin;
\.


--
-- Data for Name: realm_supported_locales; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.realm_supported_locales (realm_id, value) FROM stdin;
\.


--
-- Data for Name: redirect_uris; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.redirect_uris (client_id, value) FROM stdin;
e549e79e-4e77-425f-8611-8eefc4f267da	/realms/master/account/*
3fb776f9-9b41-4997-b3b8-cff334bc72fc	/realms/master/account/*
e6857f1f-a8d7-4fe0-bdf8-b7dd7685d50f	/admin/master/console/*
fecc6bc0-e452-4102-8c7c-f8364d65a61a	/realms/hocus/account/*
024e7161-fb12-44a1-bc21-b2d03e26d3ee	/admin/hocus/console/*
a16f9d56-89da-4707-8e7b-8e351372e3d3	/realms/hocus/account/*
ade0aace-88fa-4e18-90ae-a7d816a349e6	http://localhost:3000/app/callback
\.


--
-- Data for Name: required_action_config; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.required_action_config (required_action_id, value, name) FROM stdin;
\.


--
-- Data for Name: required_action_provider; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.required_action_provider (id, alias, name, realm_id, enabled, default_action, provider_id, priority) FROM stdin;
76b668db-54b1-4999-ad36-333fc988c138	VERIFY_EMAIL	Verify Email	65e9a13f-13e5-431c-8500-c136a2014a70	t	f	VERIFY_EMAIL	50
3f3c5907-70c6-4f21-b229-53d868a8a0e0	UPDATE_PROFILE	Update Profile	65e9a13f-13e5-431c-8500-c136a2014a70	t	f	UPDATE_PROFILE	40
033652d1-0466-43c0-9b5c-a99f4a6d6e71	CONFIGURE_TOTP	Configure OTP	65e9a13f-13e5-431c-8500-c136a2014a70	t	f	CONFIGURE_TOTP	10
e2e61aeb-cfed-4d16-b72b-de61b05ca8b0	UPDATE_PASSWORD	Update Password	65e9a13f-13e5-431c-8500-c136a2014a70	t	f	UPDATE_PASSWORD	30
928c444f-f6ee-4cfe-9866-dde7cf18018d	terms_and_conditions	Terms and Conditions	65e9a13f-13e5-431c-8500-c136a2014a70	f	f	terms_and_conditions	20
7e46b3ab-f0f6-49bb-a15f-dd5cad5d2913	update_user_locale	Update User Locale	65e9a13f-13e5-431c-8500-c136a2014a70	t	f	update_user_locale	1000
426500b5-9241-47b9-8b33-afae626bf746	delete_account	Delete Account	65e9a13f-13e5-431c-8500-c136a2014a70	f	f	delete_account	60
667d9d51-3e7e-413b-8656-3925c749cb0a	webauthn-register	Webauthn Register	65e9a13f-13e5-431c-8500-c136a2014a70	t	f	webauthn-register	70
e41029cd-2f54-4fb5-bb45-cd7c210bf0e0	webauthn-register-passwordless	Webauthn Register Passwordless	65e9a13f-13e5-431c-8500-c136a2014a70	t	f	webauthn-register-passwordless	80
50d02302-8ba8-4052-aea8-2f4b855c5bd4	CONFIGURE_TOTP	Configure OTP	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	t	f	CONFIGURE_TOTP	10
5763d669-28d6-483d-bbce-ad205da32051	terms_and_conditions	Terms and Conditions	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	f	f	terms_and_conditions	20
519aba4c-94c7-479b-83aa-5dd6f75363ec	UPDATE_PASSWORD	Update Password	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	t	f	UPDATE_PASSWORD	30
6d322060-c1ea-464f-9d7a-ed8ac0cd7c56	UPDATE_PROFILE	Update Profile	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	t	f	UPDATE_PROFILE	40
89591fd9-2c0d-4039-9ef7-1157d11b571f	VERIFY_EMAIL	Verify Email	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	t	f	VERIFY_EMAIL	50
05c019d4-94a5-448e-8124-9191767af49a	delete_account	Delete Account	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	f	f	delete_account	60
0d2516f8-ab76-4afe-b694-2a3fa2cdc54e	webauthn-register	Webauthn Register	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	t	f	webauthn-register	70
d0ed8150-61cb-4eb4-bb3b-b79893ccb2d9	webauthn-register-passwordless	Webauthn Register Passwordless	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	t	f	webauthn-register-passwordless	80
7831240b-1dca-4db4-af49-28b4487ebb1e	update_user_locale	Update User Locale	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	t	f	update_user_locale	1000
\.


--
-- Data for Name: resource_attribute; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.resource_attribute (id, name, value, resource_id) FROM stdin;
\.


--
-- Data for Name: resource_policy; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.resource_policy (resource_id, policy_id) FROM stdin;
\.


--
-- Data for Name: resource_scope; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.resource_scope (resource_id, scope_id) FROM stdin;
\.


--
-- Data for Name: resource_server; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.resource_server (id, allow_rs_remote_mgmt, policy_enforce_mode, decision_strategy) FROM stdin;
ad5a10c6-c1c6-4f54-8b86-c0ffa7df772c	f	0	1
\.


--
-- Data for Name: resource_server_perm_ticket; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.resource_server_perm_ticket (id, owner, requester, created_timestamp, granted_timestamp, resource_id, scope_id, resource_server_id, policy_id) FROM stdin;
\.


--
-- Data for Name: resource_server_policy; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.resource_server_policy (id, name, description, type, decision_strategy, logic, resource_server_id, owner) FROM stdin;
\.


--
-- Data for Name: resource_server_resource; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.resource_server_resource (id, name, type, icon_uri, owner, resource_server_id, owner_managed_access, display_name) FROM stdin;
\.


--
-- Data for Name: resource_server_scope; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.resource_server_scope (id, name, icon_uri, resource_server_id, display_name) FROM stdin;
\.


--
-- Data for Name: resource_uris; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.resource_uris (resource_id, value) FROM stdin;
\.


--
-- Data for Name: role_attribute; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.role_attribute (id, role_id, name, value) FROM stdin;
\.


--
-- Data for Name: scope_mapping; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.scope_mapping (client_id, role_id) FROM stdin;
3fb776f9-9b41-4997-b3b8-cff334bc72fc	6fb1586d-36cd-4b67-84d7-b3d8b6b0e468
\.


--
-- Data for Name: scope_policy; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.scope_policy (scope_id, policy_id) FROM stdin;
\.


--
-- Data for Name: user_attribute; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_attribute (name, value, user_id, id) FROM stdin;
\.


--
-- Data for Name: user_consent; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_consent (id, client_id, user_id, created_date, last_updated_date, client_storage_provider, external_client_id) FROM stdin;
\.


--
-- Data for Name: user_consent_client_scope; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_consent_client_scope (user_consent_id, scope_id) FROM stdin;
\.


--
-- Data for Name: user_entity; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_entity (id, email, email_constraint, email_verified, enabled, federation_link, first_name, last_name, realm_id, username, created_timestamp, service_account_client_link, not_before) FROM stdin;
08766cb6-30f0-4060-bbae-b5cde0c325be	\N	b1366559-0f3b-41a3-92a6-ab0c31095a30	f	t	\N	\N	\N	65e9a13f-13e5-431c-8500-c136a2014a70	admin	1664040029975	\N	0
62f57438-be34-4c20-8901-c6cb7c893db4	\N	7334e327-848f-42fc-978f-15bc1da0430f	f	t	\N	\N	\N	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	service-account-realm-management	1664040029576	ad5a10c6-c1c6-4f54-8b86-c0ffa7df772c	0
7480bd02-16d0-4727-a3dc-3832144aaa95	dev@example.com	dev@example.com	f	t	\N	dev	dev	8ce1928e-b671-44b2-ab2f-ba0a2fc46762	dev	1677336830307	\N	0
\.


--
-- Data for Name: user_federation_config; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_federation_config (user_federation_provider_id, value, name) FROM stdin;
\.


--
-- Data for Name: user_federation_mapper; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_federation_mapper (id, name, federation_provider_id, federation_mapper_type, realm_id) FROM stdin;
\.


--
-- Data for Name: user_federation_mapper_config; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_federation_mapper_config (user_federation_mapper_id, value, name) FROM stdin;
\.


--
-- Data for Name: user_federation_provider; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_federation_provider (id, changed_sync_period, display_name, full_sync_period, last_sync, priority, provider_name, realm_id) FROM stdin;
\.


--
-- Data for Name: user_group_membership; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_group_membership (group_id, user_id) FROM stdin;
\.


--
-- Data for Name: user_required_action; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_required_action (user_id, required_action) FROM stdin;
\.


--
-- Data for Name: user_role_mapping; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_role_mapping (role_id, user_id) FROM stdin;
c3729e00-622c-4432-b7c4-30929326b88f	08766cb6-30f0-4060-bbae-b5cde0c325be
88d4f17e-2eb0-4b28-8ce2-7d53301ad91a	08766cb6-30f0-4060-bbae-b5cde0c325be
e8c01625-cda6-4510-a2d6-29214855ce90	7480bd02-16d0-4727-a3dc-3832144aaa95
\.


--
-- Data for Name: user_session; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_session (id, auth_method, ip_address, last_session_refresh, login_username, realm_id, remember_me, started, user_id, user_session_state, broker_session_id, broker_user_id) FROM stdin;
\.


--
-- Data for Name: user_session_note; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_session_note (user_session, name, value) FROM stdin;
\.


--
-- Data for Name: username_login_failure; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.username_login_failure (realm_id, username, failed_login_not_before, last_failure, last_ip_failure, num_failures) FROM stdin;
\.


--
-- Data for Name: web_origins; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.web_origins (client_id, value) FROM stdin;
e6857f1f-a8d7-4fe0-bdf8-b7dd7685d50f	+
024e7161-fb12-44a1-bc21-b2d03e26d3ee	+
\.


--
-- Name: username_login_failure CONSTRAINT_17-2; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.username_login_failure
    ADD CONSTRAINT "CONSTRAINT_17-2" PRIMARY KEY (realm_id, username);


--
-- Name: keycloak_role UK_J3RWUVD56ONTGSUHOGM184WW2-2; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.keycloak_role
    ADD CONSTRAINT "UK_J3RWUVD56ONTGSUHOGM184WW2-2" UNIQUE (name, client_realm_constraint);


--
-- Name: client_auth_flow_bindings c_cli_flow_bind; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_auth_flow_bindings
    ADD CONSTRAINT c_cli_flow_bind PRIMARY KEY (client_id, binding_name);


--
-- Name: client_scope_client c_cli_scope_bind; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_scope_client
    ADD CONSTRAINT c_cli_scope_bind PRIMARY KEY (client_id, scope_id);


--
-- Name: client_initial_access cnstr_client_init_acc_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_initial_access
    ADD CONSTRAINT cnstr_client_init_acc_pk PRIMARY KEY (id);


--
-- Name: realm_default_groups con_group_id_def_groups; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.realm_default_groups
    ADD CONSTRAINT con_group_id_def_groups UNIQUE (group_id);


--
-- Name: broker_link constr_broker_link_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.broker_link
    ADD CONSTRAINT constr_broker_link_pk PRIMARY KEY (identity_provider, user_id);


--
-- Name: client_user_session_note constr_cl_usr_ses_note; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_user_session_note
    ADD CONSTRAINT constr_cl_usr_ses_note PRIMARY KEY (client_session, name);


--
-- Name: component_config constr_component_config_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.component_config
    ADD CONSTRAINT constr_component_config_pk PRIMARY KEY (id);


--
-- Name: component constr_component_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.component
    ADD CONSTRAINT constr_component_pk PRIMARY KEY (id);


--
-- Name: fed_user_required_action constr_fed_required_action; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fed_user_required_action
    ADD CONSTRAINT constr_fed_required_action PRIMARY KEY (required_action, user_id);


--
-- Name: fed_user_attribute constr_fed_user_attr_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fed_user_attribute
    ADD CONSTRAINT constr_fed_user_attr_pk PRIMARY KEY (id);


--
-- Name: fed_user_consent constr_fed_user_consent_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fed_user_consent
    ADD CONSTRAINT constr_fed_user_consent_pk PRIMARY KEY (id);


--
-- Name: fed_user_credential constr_fed_user_cred_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fed_user_credential
    ADD CONSTRAINT constr_fed_user_cred_pk PRIMARY KEY (id);


--
-- Name: fed_user_group_membership constr_fed_user_group; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fed_user_group_membership
    ADD CONSTRAINT constr_fed_user_group PRIMARY KEY (group_id, user_id);


--
-- Name: fed_user_role_mapping constr_fed_user_role; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fed_user_role_mapping
    ADD CONSTRAINT constr_fed_user_role PRIMARY KEY (role_id, user_id);


--
-- Name: federated_user constr_federated_user; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.federated_user
    ADD CONSTRAINT constr_federated_user PRIMARY KEY (id);


--
-- Name: realm_default_groups constr_realm_default_groups; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.realm_default_groups
    ADD CONSTRAINT constr_realm_default_groups PRIMARY KEY (realm_id, group_id);


--
-- Name: realm_enabled_event_types constr_realm_enabl_event_types; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.realm_enabled_event_types
    ADD CONSTRAINT constr_realm_enabl_event_types PRIMARY KEY (realm_id, value);


--
-- Name: realm_events_listeners constr_realm_events_listeners; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.realm_events_listeners
    ADD CONSTRAINT constr_realm_events_listeners PRIMARY KEY (realm_id, value);


--
-- Name: realm_supported_locales constr_realm_supported_locales; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.realm_supported_locales
    ADD CONSTRAINT constr_realm_supported_locales PRIMARY KEY (realm_id, value);


--
-- Name: identity_provider constraint_2b; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.identity_provider
    ADD CONSTRAINT constraint_2b PRIMARY KEY (internal_id);


--
-- Name: client_attributes constraint_3c; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_attributes
    ADD CONSTRAINT constraint_3c PRIMARY KEY (client_id, name);


--
-- Name: event_entity constraint_4; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.event_entity
    ADD CONSTRAINT constraint_4 PRIMARY KEY (id);


--
-- Name: federated_identity constraint_40; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.federated_identity
    ADD CONSTRAINT constraint_40 PRIMARY KEY (identity_provider, user_id);


--
-- Name: realm constraint_4a; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.realm
    ADD CONSTRAINT constraint_4a PRIMARY KEY (id);


--
-- Name: client_session_role constraint_5; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_session_role
    ADD CONSTRAINT constraint_5 PRIMARY KEY (client_session, role_id);


--
-- Name: user_session constraint_57; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_session
    ADD CONSTRAINT constraint_57 PRIMARY KEY (id);


--
-- Name: user_federation_provider constraint_5c; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_federation_provider
    ADD CONSTRAINT constraint_5c PRIMARY KEY (id);


--
-- Name: client_session_note constraint_5e; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_session_note
    ADD CONSTRAINT constraint_5e PRIMARY KEY (client_session, name);


--
-- Name: client constraint_7; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client
    ADD CONSTRAINT constraint_7 PRIMARY KEY (id);


--
-- Name: client_session constraint_8; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_session
    ADD CONSTRAINT constraint_8 PRIMARY KEY (id);


--
-- Name: scope_mapping constraint_81; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scope_mapping
    ADD CONSTRAINT constraint_81 PRIMARY KEY (client_id, role_id);


--
-- Name: client_node_registrations constraint_84; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_node_registrations
    ADD CONSTRAINT constraint_84 PRIMARY KEY (client_id, name);


--
-- Name: realm_attribute constraint_9; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.realm_attribute
    ADD CONSTRAINT constraint_9 PRIMARY KEY (name, realm_id);


--
-- Name: realm_required_credential constraint_92; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.realm_required_credential
    ADD CONSTRAINT constraint_92 PRIMARY KEY (realm_id, type);


--
-- Name: keycloak_role constraint_a; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.keycloak_role
    ADD CONSTRAINT constraint_a PRIMARY KEY (id);


--
-- Name: admin_event_entity constraint_admin_event_entity; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_event_entity
    ADD CONSTRAINT constraint_admin_event_entity PRIMARY KEY (id);


--
-- Name: authenticator_config_entry constraint_auth_cfg_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.authenticator_config_entry
    ADD CONSTRAINT constraint_auth_cfg_pk PRIMARY KEY (authenticator_id, name);


--
-- Name: authentication_execution constraint_auth_exec_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.authentication_execution
    ADD CONSTRAINT constraint_auth_exec_pk PRIMARY KEY (id);


--
-- Name: authentication_flow constraint_auth_flow_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.authentication_flow
    ADD CONSTRAINT constraint_auth_flow_pk PRIMARY KEY (id);


--
-- Name: authenticator_config constraint_auth_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.authenticator_config
    ADD CONSTRAINT constraint_auth_pk PRIMARY KEY (id);


--
-- Name: client_session_auth_status constraint_auth_status_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_session_auth_status
    ADD CONSTRAINT constraint_auth_status_pk PRIMARY KEY (client_session, authenticator);


--
-- Name: user_role_mapping constraint_c; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_role_mapping
    ADD CONSTRAINT constraint_c PRIMARY KEY (role_id, user_id);


--
-- Name: composite_role constraint_composite_role; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.composite_role
    ADD CONSTRAINT constraint_composite_role PRIMARY KEY (composite, child_role);


--
-- Name: client_session_prot_mapper constraint_cs_pmp_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_session_prot_mapper
    ADD CONSTRAINT constraint_cs_pmp_pk PRIMARY KEY (client_session, protocol_mapper_id);


--
-- Name: identity_provider_config constraint_d; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.identity_provider_config
    ADD CONSTRAINT constraint_d PRIMARY KEY (identity_provider_id, name);


--
-- Name: policy_config constraint_dpc; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.policy_config
    ADD CONSTRAINT constraint_dpc PRIMARY KEY (policy_id, name);


--
-- Name: realm_smtp_config constraint_e; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.realm_smtp_config
    ADD CONSTRAINT constraint_e PRIMARY KEY (realm_id, name);


--
-- Name: credential constraint_f; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.credential
    ADD CONSTRAINT constraint_f PRIMARY KEY (id);


--
-- Name: user_federation_config constraint_f9; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_federation_config
    ADD CONSTRAINT constraint_f9 PRIMARY KEY (user_federation_provider_id, name);


--
-- Name: resource_server_perm_ticket constraint_fapmt; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resource_server_perm_ticket
    ADD CONSTRAINT constraint_fapmt PRIMARY KEY (id);


--
-- Name: resource_server_resource constraint_farsr; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resource_server_resource
    ADD CONSTRAINT constraint_farsr PRIMARY KEY (id);


--
-- Name: resource_server_policy constraint_farsrp; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resource_server_policy
    ADD CONSTRAINT constraint_farsrp PRIMARY KEY (id);


--
-- Name: associated_policy constraint_farsrpap; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.associated_policy
    ADD CONSTRAINT constraint_farsrpap PRIMARY KEY (policy_id, associated_policy_id);


--
-- Name: resource_policy constraint_farsrpp; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resource_policy
    ADD CONSTRAINT constraint_farsrpp PRIMARY KEY (resource_id, policy_id);


--
-- Name: resource_server_scope constraint_farsrs; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resource_server_scope
    ADD CONSTRAINT constraint_farsrs PRIMARY KEY (id);


--
-- Name: resource_scope constraint_farsrsp; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resource_scope
    ADD CONSTRAINT constraint_farsrsp PRIMARY KEY (resource_id, scope_id);


--
-- Name: scope_policy constraint_farsrsps; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scope_policy
    ADD CONSTRAINT constraint_farsrsps PRIMARY KEY (scope_id, policy_id);


--
-- Name: user_entity constraint_fb; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_entity
    ADD CONSTRAINT constraint_fb PRIMARY KEY (id);


--
-- Name: user_federation_mapper_config constraint_fedmapper_cfg_pm; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_federation_mapper_config
    ADD CONSTRAINT constraint_fedmapper_cfg_pm PRIMARY KEY (user_federation_mapper_id, name);


--
-- Name: user_federation_mapper constraint_fedmapperpm; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_federation_mapper
    ADD CONSTRAINT constraint_fedmapperpm PRIMARY KEY (id);


--
-- Name: fed_user_consent_cl_scope constraint_fgrntcsnt_clsc_pm; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fed_user_consent_cl_scope
    ADD CONSTRAINT constraint_fgrntcsnt_clsc_pm PRIMARY KEY (user_consent_id, scope_id);


--
-- Name: user_consent_client_scope constraint_grntcsnt_clsc_pm; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_consent_client_scope
    ADD CONSTRAINT constraint_grntcsnt_clsc_pm PRIMARY KEY (user_consent_id, scope_id);


--
-- Name: user_consent constraint_grntcsnt_pm; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_consent
    ADD CONSTRAINT constraint_grntcsnt_pm PRIMARY KEY (id);


--
-- Name: keycloak_group constraint_group; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.keycloak_group
    ADD CONSTRAINT constraint_group PRIMARY KEY (id);


--
-- Name: group_attribute constraint_group_attribute_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.group_attribute
    ADD CONSTRAINT constraint_group_attribute_pk PRIMARY KEY (id);


--
-- Name: group_role_mapping constraint_group_role; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.group_role_mapping
    ADD CONSTRAINT constraint_group_role PRIMARY KEY (role_id, group_id);


--
-- Name: identity_provider_mapper constraint_idpm; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.identity_provider_mapper
    ADD CONSTRAINT constraint_idpm PRIMARY KEY (id);


--
-- Name: idp_mapper_config constraint_idpmconfig; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.idp_mapper_config
    ADD CONSTRAINT constraint_idpmconfig PRIMARY KEY (idp_mapper_id, name);


--
-- Name: migration_model constraint_migmod; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.migration_model
    ADD CONSTRAINT constraint_migmod PRIMARY KEY (id);


--
-- Name: offline_client_session constraint_offl_cl_ses_pk3; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.offline_client_session
    ADD CONSTRAINT constraint_offl_cl_ses_pk3 PRIMARY KEY (user_session_id, client_id, client_storage_provider, external_client_id, offline_flag);


--
-- Name: offline_user_session constraint_offl_us_ses_pk2; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.offline_user_session
    ADD CONSTRAINT constraint_offl_us_ses_pk2 PRIMARY KEY (user_session_id, offline_flag);


--
-- Name: protocol_mapper constraint_pcm; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.protocol_mapper
    ADD CONSTRAINT constraint_pcm PRIMARY KEY (id);


--
-- Name: protocol_mapper_config constraint_pmconfig; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.protocol_mapper_config
    ADD CONSTRAINT constraint_pmconfig PRIMARY KEY (protocol_mapper_id, name);


--
-- Name: redirect_uris constraint_redirect_uris; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.redirect_uris
    ADD CONSTRAINT constraint_redirect_uris PRIMARY KEY (client_id, value);


--
-- Name: required_action_config constraint_req_act_cfg_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.required_action_config
    ADD CONSTRAINT constraint_req_act_cfg_pk PRIMARY KEY (required_action_id, name);


--
-- Name: required_action_provider constraint_req_act_prv_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.required_action_provider
    ADD CONSTRAINT constraint_req_act_prv_pk PRIMARY KEY (id);


--
-- Name: user_required_action constraint_required_action; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_required_action
    ADD CONSTRAINT constraint_required_action PRIMARY KEY (required_action, user_id);


--
-- Name: resource_uris constraint_resour_uris_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resource_uris
    ADD CONSTRAINT constraint_resour_uris_pk PRIMARY KEY (resource_id, value);


--
-- Name: role_attribute constraint_role_attribute_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_attribute
    ADD CONSTRAINT constraint_role_attribute_pk PRIMARY KEY (id);


--
-- Name: user_attribute constraint_user_attribute_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_attribute
    ADD CONSTRAINT constraint_user_attribute_pk PRIMARY KEY (id);


--
-- Name: user_group_membership constraint_user_group; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_group_membership
    ADD CONSTRAINT constraint_user_group PRIMARY KEY (group_id, user_id);


--
-- Name: user_session_note constraint_usn_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_session_note
    ADD CONSTRAINT constraint_usn_pk PRIMARY KEY (user_session, name);


--
-- Name: web_origins constraint_web_origins; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.web_origins
    ADD CONSTRAINT constraint_web_origins PRIMARY KEY (client_id, value);


--
-- Name: databasechangeloglock databasechangeloglock_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.databasechangeloglock
    ADD CONSTRAINT databasechangeloglock_pkey PRIMARY KEY (id);


--
-- Name: client_scope_attributes pk_cl_tmpl_attr; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_scope_attributes
    ADD CONSTRAINT pk_cl_tmpl_attr PRIMARY KEY (scope_id, name);


--
-- Name: client_scope pk_cli_template; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_scope
    ADD CONSTRAINT pk_cli_template PRIMARY KEY (id);


--
-- Name: resource_server pk_resource_server; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resource_server
    ADD CONSTRAINT pk_resource_server PRIMARY KEY (id);


--
-- Name: client_scope_role_mapping pk_template_scope; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_scope_role_mapping
    ADD CONSTRAINT pk_template_scope PRIMARY KEY (scope_id, role_id);


--
-- Name: default_client_scope r_def_cli_scope_bind; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.default_client_scope
    ADD CONSTRAINT r_def_cli_scope_bind PRIMARY KEY (realm_id, scope_id);


--
-- Name: realm_localizations realm_localizations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.realm_localizations
    ADD CONSTRAINT realm_localizations_pkey PRIMARY KEY (realm_id, locale);


--
-- Name: resource_attribute res_attr_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resource_attribute
    ADD CONSTRAINT res_attr_pk PRIMARY KEY (id);


--
-- Name: keycloak_group sibling_names; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.keycloak_group
    ADD CONSTRAINT sibling_names UNIQUE (realm_id, parent_group, name);


--
-- Name: identity_provider uk_2daelwnibji49avxsrtuf6xj33; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.identity_provider
    ADD CONSTRAINT uk_2daelwnibji49avxsrtuf6xj33 UNIQUE (provider_alias, realm_id);


--
-- Name: client uk_b71cjlbenv945rb6gcon438at; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client
    ADD CONSTRAINT uk_b71cjlbenv945rb6gcon438at UNIQUE (realm_id, client_id);


--
-- Name: client_scope uk_cli_scope; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_scope
    ADD CONSTRAINT uk_cli_scope UNIQUE (realm_id, name);


--
-- Name: user_entity uk_dykn684sl8up1crfei6eckhd7; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_entity
    ADD CONSTRAINT uk_dykn684sl8up1crfei6eckhd7 UNIQUE (realm_id, email_constraint);


--
-- Name: resource_server_resource uk_frsr6t700s9v50bu18ws5ha6; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resource_server_resource
    ADD CONSTRAINT uk_frsr6t700s9v50bu18ws5ha6 UNIQUE (name, owner, resource_server_id);


--
-- Name: resource_server_perm_ticket uk_frsr6t700s9v50bu18ws5pmt; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resource_server_perm_ticket
    ADD CONSTRAINT uk_frsr6t700s9v50bu18ws5pmt UNIQUE (owner, requester, resource_server_id, resource_id, scope_id);


--
-- Name: resource_server_policy uk_frsrpt700s9v50bu18ws5ha6; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resource_server_policy
    ADD CONSTRAINT uk_frsrpt700s9v50bu18ws5ha6 UNIQUE (name, resource_server_id);


--
-- Name: resource_server_scope uk_frsrst700s9v50bu18ws5ha6; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resource_server_scope
    ADD CONSTRAINT uk_frsrst700s9v50bu18ws5ha6 UNIQUE (name, resource_server_id);


--
-- Name: user_consent uk_jkuwuvd56ontgsuhogm8uewrt; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_consent
    ADD CONSTRAINT uk_jkuwuvd56ontgsuhogm8uewrt UNIQUE (client_id, client_storage_provider, external_client_id, user_id);


--
-- Name: realm uk_orvsdmla56612eaefiq6wl5oi; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.realm
    ADD CONSTRAINT uk_orvsdmla56612eaefiq6wl5oi UNIQUE (name);


--
-- Name: user_entity uk_ru8tt6t700s9v50bu18ws5ha6; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_entity
    ADD CONSTRAINT uk_ru8tt6t700s9v50bu18ws5ha6 UNIQUE (realm_id, username);


--
-- Name: idx_admin_event_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_admin_event_time ON public.admin_event_entity USING btree (realm_id, admin_event_time);


--
-- Name: idx_assoc_pol_assoc_pol_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assoc_pol_assoc_pol_id ON public.associated_policy USING btree (associated_policy_id);


--
-- Name: idx_auth_config_realm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_auth_config_realm ON public.authenticator_config USING btree (realm_id);


--
-- Name: idx_auth_exec_flow; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_auth_exec_flow ON public.authentication_execution USING btree (flow_id);


--
-- Name: idx_auth_exec_realm_flow; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_auth_exec_realm_flow ON public.authentication_execution USING btree (realm_id, flow_id);


--
-- Name: idx_auth_flow_realm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_auth_flow_realm ON public.authentication_flow USING btree (realm_id);


--
-- Name: idx_cl_clscope; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cl_clscope ON public.client_scope_client USING btree (scope_id);


--
-- Name: idx_client_att_by_name_value; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_client_att_by_name_value ON public.client_attributes USING btree (name, ((value)::character varying(250)));


--
-- Name: idx_client_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_client_id ON public.client USING btree (client_id);


--
-- Name: idx_client_init_acc_realm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_client_init_acc_realm ON public.client_initial_access USING btree (realm_id);


--
-- Name: idx_client_session_session; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_client_session_session ON public.client_session USING btree (session_id);


--
-- Name: idx_clscope_attrs; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_clscope_attrs ON public.client_scope_attributes USING btree (scope_id);


--
-- Name: idx_clscope_cl; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_clscope_cl ON public.client_scope_client USING btree (client_id);


--
-- Name: idx_clscope_protmap; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_clscope_protmap ON public.protocol_mapper USING btree (client_scope_id);


--
-- Name: idx_clscope_role; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_clscope_role ON public.client_scope_role_mapping USING btree (scope_id);


--
-- Name: idx_compo_config_compo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_compo_config_compo ON public.component_config USING btree (component_id);


--
-- Name: idx_component_provider_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_component_provider_type ON public.component USING btree (provider_type);


--
-- Name: idx_component_realm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_component_realm ON public.component USING btree (realm_id);


--
-- Name: idx_composite; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_composite ON public.composite_role USING btree (composite);


--
-- Name: idx_composite_child; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_composite_child ON public.composite_role USING btree (child_role);


--
-- Name: idx_defcls_realm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_defcls_realm ON public.default_client_scope USING btree (realm_id);


--
-- Name: idx_defcls_scope; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_defcls_scope ON public.default_client_scope USING btree (scope_id);


--
-- Name: idx_event_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_event_time ON public.event_entity USING btree (realm_id, event_time);


--
-- Name: idx_fedidentity_feduser; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_fedidentity_feduser ON public.federated_identity USING btree (federated_user_id);


--
-- Name: idx_fedidentity_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_fedidentity_user ON public.federated_identity USING btree (user_id);


--
-- Name: idx_fu_attribute; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_fu_attribute ON public.fed_user_attribute USING btree (user_id, realm_id, name);


--
-- Name: idx_fu_cnsnt_ext; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_fu_cnsnt_ext ON public.fed_user_consent USING btree (user_id, client_storage_provider, external_client_id);


--
-- Name: idx_fu_consent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_fu_consent ON public.fed_user_consent USING btree (user_id, client_id);


--
-- Name: idx_fu_consent_ru; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_fu_consent_ru ON public.fed_user_consent USING btree (realm_id, user_id);


--
-- Name: idx_fu_credential; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_fu_credential ON public.fed_user_credential USING btree (user_id, type);


--
-- Name: idx_fu_credential_ru; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_fu_credential_ru ON public.fed_user_credential USING btree (realm_id, user_id);


--
-- Name: idx_fu_group_membership; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_fu_group_membership ON public.fed_user_group_membership USING btree (user_id, group_id);


--
-- Name: idx_fu_group_membership_ru; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_fu_group_membership_ru ON public.fed_user_group_membership USING btree (realm_id, user_id);


--
-- Name: idx_fu_required_action; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_fu_required_action ON public.fed_user_required_action USING btree (user_id, required_action);


--
-- Name: idx_fu_required_action_ru; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_fu_required_action_ru ON public.fed_user_required_action USING btree (realm_id, user_id);


--
-- Name: idx_fu_role_mapping; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_fu_role_mapping ON public.fed_user_role_mapping USING btree (user_id, role_id);


--
-- Name: idx_fu_role_mapping_ru; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_fu_role_mapping_ru ON public.fed_user_role_mapping USING btree (realm_id, user_id);


--
-- Name: idx_group_attr_group; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_group_attr_group ON public.group_attribute USING btree (group_id);


--
-- Name: idx_group_role_mapp_group; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_group_role_mapp_group ON public.group_role_mapping USING btree (group_id);


--
-- Name: idx_id_prov_mapp_realm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_id_prov_mapp_realm ON public.identity_provider_mapper USING btree (realm_id);


--
-- Name: idx_ident_prov_realm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ident_prov_realm ON public.identity_provider USING btree (realm_id);


--
-- Name: idx_keycloak_role_client; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_keycloak_role_client ON public.keycloak_role USING btree (client);


--
-- Name: idx_keycloak_role_realm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_keycloak_role_realm ON public.keycloak_role USING btree (realm);


--
-- Name: idx_offline_css_preload; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_offline_css_preload ON public.offline_client_session USING btree (client_id, offline_flag);


--
-- Name: idx_offline_uss_by_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_offline_uss_by_user ON public.offline_user_session USING btree (user_id, realm_id, offline_flag);


--
-- Name: idx_offline_uss_by_usersess; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_offline_uss_by_usersess ON public.offline_user_session USING btree (realm_id, offline_flag, user_session_id);


--
-- Name: idx_offline_uss_createdon; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_offline_uss_createdon ON public.offline_user_session USING btree (created_on);


--
-- Name: idx_offline_uss_preload; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_offline_uss_preload ON public.offline_user_session USING btree (offline_flag, created_on, user_session_id);


--
-- Name: idx_protocol_mapper_client; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_protocol_mapper_client ON public.protocol_mapper USING btree (client_id);


--
-- Name: idx_realm_attr_realm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_realm_attr_realm ON public.realm_attribute USING btree (realm_id);


--
-- Name: idx_realm_clscope; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_realm_clscope ON public.client_scope USING btree (realm_id);


--
-- Name: idx_realm_def_grp_realm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_realm_def_grp_realm ON public.realm_default_groups USING btree (realm_id);


--
-- Name: idx_realm_evt_list_realm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_realm_evt_list_realm ON public.realm_events_listeners USING btree (realm_id);


--
-- Name: idx_realm_evt_types_realm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_realm_evt_types_realm ON public.realm_enabled_event_types USING btree (realm_id);


--
-- Name: idx_realm_master_adm_cli; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_realm_master_adm_cli ON public.realm USING btree (master_admin_client);


--
-- Name: idx_realm_supp_local_realm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_realm_supp_local_realm ON public.realm_supported_locales USING btree (realm_id);


--
-- Name: idx_redir_uri_client; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_redir_uri_client ON public.redirect_uris USING btree (client_id);


--
-- Name: idx_req_act_prov_realm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_req_act_prov_realm ON public.required_action_provider USING btree (realm_id);


--
-- Name: idx_res_policy_policy; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_res_policy_policy ON public.resource_policy USING btree (policy_id);


--
-- Name: idx_res_scope_scope; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_res_scope_scope ON public.resource_scope USING btree (scope_id);


--
-- Name: idx_res_serv_pol_res_serv; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_res_serv_pol_res_serv ON public.resource_server_policy USING btree (resource_server_id);


--
-- Name: idx_res_srv_res_res_srv; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_res_srv_res_res_srv ON public.resource_server_resource USING btree (resource_server_id);


--
-- Name: idx_res_srv_scope_res_srv; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_res_srv_scope_res_srv ON public.resource_server_scope USING btree (resource_server_id);


--
-- Name: idx_role_attribute; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_role_attribute ON public.role_attribute USING btree (role_id);


--
-- Name: idx_role_clscope; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_role_clscope ON public.client_scope_role_mapping USING btree (role_id);


--
-- Name: idx_scope_mapping_role; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_scope_mapping_role ON public.scope_mapping USING btree (role_id);


--
-- Name: idx_scope_policy_policy; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_scope_policy_policy ON public.scope_policy USING btree (policy_id);


--
-- Name: idx_update_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_update_time ON public.migration_model USING btree (update_time);


--
-- Name: idx_us_sess_id_on_cl_sess; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_us_sess_id_on_cl_sess ON public.offline_client_session USING btree (user_session_id);


--
-- Name: idx_usconsent_clscope; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_usconsent_clscope ON public.user_consent_client_scope USING btree (user_consent_id);


--
-- Name: idx_user_attribute; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_attribute ON public.user_attribute USING btree (user_id);


--
-- Name: idx_user_attribute_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_attribute_name ON public.user_attribute USING btree (name, value);


--
-- Name: idx_user_consent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_consent ON public.user_consent USING btree (user_id);


--
-- Name: idx_user_credential; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_credential ON public.credential USING btree (user_id);


--
-- Name: idx_user_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_email ON public.user_entity USING btree (email);


--
-- Name: idx_user_group_mapping; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_group_mapping ON public.user_group_membership USING btree (user_id);


--
-- Name: idx_user_reqactions; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_reqactions ON public.user_required_action USING btree (user_id);


--
-- Name: idx_user_role_mapping; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_role_mapping ON public.user_role_mapping USING btree (user_id);


--
-- Name: idx_user_service_account; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_service_account ON public.user_entity USING btree (realm_id, service_account_client_link);


--
-- Name: idx_usr_fed_map_fed_prv; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_usr_fed_map_fed_prv ON public.user_federation_mapper USING btree (federation_provider_id);


--
-- Name: idx_usr_fed_map_realm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_usr_fed_map_realm ON public.user_federation_mapper USING btree (realm_id);


--
-- Name: idx_usr_fed_prv_realm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_usr_fed_prv_realm ON public.user_federation_provider USING btree (realm_id);


--
-- Name: idx_web_orig_client; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_web_orig_client ON public.web_origins USING btree (client_id);


--
-- Name: client_session_auth_status auth_status_constraint; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_session_auth_status
    ADD CONSTRAINT auth_status_constraint FOREIGN KEY (client_session) REFERENCES public.client_session(id);


--
-- Name: identity_provider fk2b4ebc52ae5c3b34; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.identity_provider
    ADD CONSTRAINT fk2b4ebc52ae5c3b34 FOREIGN KEY (realm_id) REFERENCES public.realm(id);


--
-- Name: client_attributes fk3c47c64beacca966; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_attributes
    ADD CONSTRAINT fk3c47c64beacca966 FOREIGN KEY (client_id) REFERENCES public.client(id);


--
-- Name: federated_identity fk404288b92ef007a6; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.federated_identity
    ADD CONSTRAINT fk404288b92ef007a6 FOREIGN KEY (user_id) REFERENCES public.user_entity(id);


--
-- Name: client_node_registrations fk4129723ba992f594; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_node_registrations
    ADD CONSTRAINT fk4129723ba992f594 FOREIGN KEY (client_id) REFERENCES public.client(id);


--
-- Name: client_session_note fk5edfb00ff51c2736; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_session_note
    ADD CONSTRAINT fk5edfb00ff51c2736 FOREIGN KEY (client_session) REFERENCES public.client_session(id);


--
-- Name: user_session_note fk5edfb00ff51d3472; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_session_note
    ADD CONSTRAINT fk5edfb00ff51d3472 FOREIGN KEY (user_session) REFERENCES public.user_session(id);


--
-- Name: client_session_role fk_11b7sgqw18i532811v7o2dv76; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_session_role
    ADD CONSTRAINT fk_11b7sgqw18i532811v7o2dv76 FOREIGN KEY (client_session) REFERENCES public.client_session(id);


--
-- Name: redirect_uris fk_1burs8pb4ouj97h5wuppahv9f; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.redirect_uris
    ADD CONSTRAINT fk_1burs8pb4ouj97h5wuppahv9f FOREIGN KEY (client_id) REFERENCES public.client(id);


--
-- Name: user_federation_provider fk_1fj32f6ptolw2qy60cd8n01e8; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_federation_provider
    ADD CONSTRAINT fk_1fj32f6ptolw2qy60cd8n01e8 FOREIGN KEY (realm_id) REFERENCES public.realm(id);


--
-- Name: client_session_prot_mapper fk_33a8sgqw18i532811v7o2dk89; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_session_prot_mapper
    ADD CONSTRAINT fk_33a8sgqw18i532811v7o2dk89 FOREIGN KEY (client_session) REFERENCES public.client_session(id);


--
-- Name: realm_required_credential fk_5hg65lybevavkqfki3kponh9v; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.realm_required_credential
    ADD CONSTRAINT fk_5hg65lybevavkqfki3kponh9v FOREIGN KEY (realm_id) REFERENCES public.realm(id);


--
-- Name: resource_attribute fk_5hrm2vlf9ql5fu022kqepovbr; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resource_attribute
    ADD CONSTRAINT fk_5hrm2vlf9ql5fu022kqepovbr FOREIGN KEY (resource_id) REFERENCES public.resource_server_resource(id);


--
-- Name: user_attribute fk_5hrm2vlf9ql5fu043kqepovbr; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_attribute
    ADD CONSTRAINT fk_5hrm2vlf9ql5fu043kqepovbr FOREIGN KEY (user_id) REFERENCES public.user_entity(id);


--
-- Name: user_required_action fk_6qj3w1jw9cvafhe19bwsiuvmd; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_required_action
    ADD CONSTRAINT fk_6qj3w1jw9cvafhe19bwsiuvmd FOREIGN KEY (user_id) REFERENCES public.user_entity(id);


--
-- Name: keycloak_role fk_6vyqfe4cn4wlq8r6kt5vdsj5c; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.keycloak_role
    ADD CONSTRAINT fk_6vyqfe4cn4wlq8r6kt5vdsj5c FOREIGN KEY (realm) REFERENCES public.realm(id);


--
-- Name: realm_smtp_config fk_70ej8xdxgxd0b9hh6180irr0o; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.realm_smtp_config
    ADD CONSTRAINT fk_70ej8xdxgxd0b9hh6180irr0o FOREIGN KEY (realm_id) REFERENCES public.realm(id);


--
-- Name: realm_attribute fk_8shxd6l3e9atqukacxgpffptw; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.realm_attribute
    ADD CONSTRAINT fk_8shxd6l3e9atqukacxgpffptw FOREIGN KEY (realm_id) REFERENCES public.realm(id);


--
-- Name: composite_role fk_a63wvekftu8jo1pnj81e7mce2; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.composite_role
    ADD CONSTRAINT fk_a63wvekftu8jo1pnj81e7mce2 FOREIGN KEY (composite) REFERENCES public.keycloak_role(id);


--
-- Name: authentication_execution fk_auth_exec_flow; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.authentication_execution
    ADD CONSTRAINT fk_auth_exec_flow FOREIGN KEY (flow_id) REFERENCES public.authentication_flow(id);


--
-- Name: authentication_execution fk_auth_exec_realm; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.authentication_execution
    ADD CONSTRAINT fk_auth_exec_realm FOREIGN KEY (realm_id) REFERENCES public.realm(id);


--
-- Name: authentication_flow fk_auth_flow_realm; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.authentication_flow
    ADD CONSTRAINT fk_auth_flow_realm FOREIGN KEY (realm_id) REFERENCES public.realm(id);


--
-- Name: authenticator_config fk_auth_realm; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.authenticator_config
    ADD CONSTRAINT fk_auth_realm FOREIGN KEY (realm_id) REFERENCES public.realm(id);


--
-- Name: client_session fk_b4ao2vcvat6ukau74wbwtfqo1; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_session
    ADD CONSTRAINT fk_b4ao2vcvat6ukau74wbwtfqo1 FOREIGN KEY (session_id) REFERENCES public.user_session(id);


--
-- Name: user_role_mapping fk_c4fqv34p1mbylloxang7b1q3l; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_role_mapping
    ADD CONSTRAINT fk_c4fqv34p1mbylloxang7b1q3l FOREIGN KEY (user_id) REFERENCES public.user_entity(id);


--
-- Name: client_scope_attributes fk_cl_scope_attr_scope; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_scope_attributes
    ADD CONSTRAINT fk_cl_scope_attr_scope FOREIGN KEY (scope_id) REFERENCES public.client_scope(id);


--
-- Name: client_scope_role_mapping fk_cl_scope_rm_scope; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_scope_role_mapping
    ADD CONSTRAINT fk_cl_scope_rm_scope FOREIGN KEY (scope_id) REFERENCES public.client_scope(id);


--
-- Name: client_user_session_note fk_cl_usr_ses_note; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_user_session_note
    ADD CONSTRAINT fk_cl_usr_ses_note FOREIGN KEY (client_session) REFERENCES public.client_session(id);


--
-- Name: protocol_mapper fk_cli_scope_mapper; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.protocol_mapper
    ADD CONSTRAINT fk_cli_scope_mapper FOREIGN KEY (client_scope_id) REFERENCES public.client_scope(id);


--
-- Name: client_initial_access fk_client_init_acc_realm; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_initial_access
    ADD CONSTRAINT fk_client_init_acc_realm FOREIGN KEY (realm_id) REFERENCES public.realm(id);


--
-- Name: component_config fk_component_config; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.component_config
    ADD CONSTRAINT fk_component_config FOREIGN KEY (component_id) REFERENCES public.component(id);


--
-- Name: component fk_component_realm; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.component
    ADD CONSTRAINT fk_component_realm FOREIGN KEY (realm_id) REFERENCES public.realm(id);


--
-- Name: realm_default_groups fk_def_groups_realm; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.realm_default_groups
    ADD CONSTRAINT fk_def_groups_realm FOREIGN KEY (realm_id) REFERENCES public.realm(id);


--
-- Name: user_federation_mapper_config fk_fedmapper_cfg; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_federation_mapper_config
    ADD CONSTRAINT fk_fedmapper_cfg FOREIGN KEY (user_federation_mapper_id) REFERENCES public.user_federation_mapper(id);


--
-- Name: user_federation_mapper fk_fedmapperpm_fedprv; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_federation_mapper
    ADD CONSTRAINT fk_fedmapperpm_fedprv FOREIGN KEY (federation_provider_id) REFERENCES public.user_federation_provider(id);


--
-- Name: user_federation_mapper fk_fedmapperpm_realm; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_federation_mapper
    ADD CONSTRAINT fk_fedmapperpm_realm FOREIGN KEY (realm_id) REFERENCES public.realm(id);


--
-- Name: associated_policy fk_frsr5s213xcx4wnkog82ssrfy; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.associated_policy
    ADD CONSTRAINT fk_frsr5s213xcx4wnkog82ssrfy FOREIGN KEY (associated_policy_id) REFERENCES public.resource_server_policy(id);


--
-- Name: scope_policy fk_frsrasp13xcx4wnkog82ssrfy; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scope_policy
    ADD CONSTRAINT fk_frsrasp13xcx4wnkog82ssrfy FOREIGN KEY (policy_id) REFERENCES public.resource_server_policy(id);


--
-- Name: resource_server_perm_ticket fk_frsrho213xcx4wnkog82sspmt; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resource_server_perm_ticket
    ADD CONSTRAINT fk_frsrho213xcx4wnkog82sspmt FOREIGN KEY (resource_server_id) REFERENCES public.resource_server(id);


--
-- Name: resource_server_resource fk_frsrho213xcx4wnkog82ssrfy; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resource_server_resource
    ADD CONSTRAINT fk_frsrho213xcx4wnkog82ssrfy FOREIGN KEY (resource_server_id) REFERENCES public.resource_server(id);


--
-- Name: resource_server_perm_ticket fk_frsrho213xcx4wnkog83sspmt; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resource_server_perm_ticket
    ADD CONSTRAINT fk_frsrho213xcx4wnkog83sspmt FOREIGN KEY (resource_id) REFERENCES public.resource_server_resource(id);


--
-- Name: resource_server_perm_ticket fk_frsrho213xcx4wnkog84sspmt; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resource_server_perm_ticket
    ADD CONSTRAINT fk_frsrho213xcx4wnkog84sspmt FOREIGN KEY (scope_id) REFERENCES public.resource_server_scope(id);


--
-- Name: associated_policy fk_frsrpas14xcx4wnkog82ssrfy; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.associated_policy
    ADD CONSTRAINT fk_frsrpas14xcx4wnkog82ssrfy FOREIGN KEY (policy_id) REFERENCES public.resource_server_policy(id);


--
-- Name: scope_policy fk_frsrpass3xcx4wnkog82ssrfy; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scope_policy
    ADD CONSTRAINT fk_frsrpass3xcx4wnkog82ssrfy FOREIGN KEY (scope_id) REFERENCES public.resource_server_scope(id);


--
-- Name: resource_server_perm_ticket fk_frsrpo2128cx4wnkog82ssrfy; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resource_server_perm_ticket
    ADD CONSTRAINT fk_frsrpo2128cx4wnkog82ssrfy FOREIGN KEY (policy_id) REFERENCES public.resource_server_policy(id);


--
-- Name: resource_server_policy fk_frsrpo213xcx4wnkog82ssrfy; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resource_server_policy
    ADD CONSTRAINT fk_frsrpo213xcx4wnkog82ssrfy FOREIGN KEY (resource_server_id) REFERENCES public.resource_server(id);


--
-- Name: resource_scope fk_frsrpos13xcx4wnkog82ssrfy; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resource_scope
    ADD CONSTRAINT fk_frsrpos13xcx4wnkog82ssrfy FOREIGN KEY (resource_id) REFERENCES public.resource_server_resource(id);


--
-- Name: resource_policy fk_frsrpos53xcx4wnkog82ssrfy; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resource_policy
    ADD CONSTRAINT fk_frsrpos53xcx4wnkog82ssrfy FOREIGN KEY (resource_id) REFERENCES public.resource_server_resource(id);


--
-- Name: resource_policy fk_frsrpp213xcx4wnkog82ssrfy; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resource_policy
    ADD CONSTRAINT fk_frsrpp213xcx4wnkog82ssrfy FOREIGN KEY (policy_id) REFERENCES public.resource_server_policy(id);


--
-- Name: resource_scope fk_frsrps213xcx4wnkog82ssrfy; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resource_scope
    ADD CONSTRAINT fk_frsrps213xcx4wnkog82ssrfy FOREIGN KEY (scope_id) REFERENCES public.resource_server_scope(id);


--
-- Name: resource_server_scope fk_frsrso213xcx4wnkog82ssrfy; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resource_server_scope
    ADD CONSTRAINT fk_frsrso213xcx4wnkog82ssrfy FOREIGN KEY (resource_server_id) REFERENCES public.resource_server(id);


--
-- Name: composite_role fk_gr7thllb9lu8q4vqa4524jjy8; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.composite_role
    ADD CONSTRAINT fk_gr7thllb9lu8q4vqa4524jjy8 FOREIGN KEY (child_role) REFERENCES public.keycloak_role(id);


--
-- Name: user_consent_client_scope fk_grntcsnt_clsc_usc; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_consent_client_scope
    ADD CONSTRAINT fk_grntcsnt_clsc_usc FOREIGN KEY (user_consent_id) REFERENCES public.user_consent(id);


--
-- Name: user_consent fk_grntcsnt_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_consent
    ADD CONSTRAINT fk_grntcsnt_user FOREIGN KEY (user_id) REFERENCES public.user_entity(id);


--
-- Name: group_attribute fk_group_attribute_group; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.group_attribute
    ADD CONSTRAINT fk_group_attribute_group FOREIGN KEY (group_id) REFERENCES public.keycloak_group(id);


--
-- Name: group_role_mapping fk_group_role_group; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.group_role_mapping
    ADD CONSTRAINT fk_group_role_group FOREIGN KEY (group_id) REFERENCES public.keycloak_group(id);


--
-- Name: realm_enabled_event_types fk_h846o4h0w8epx5nwedrf5y69j; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.realm_enabled_event_types
    ADD CONSTRAINT fk_h846o4h0w8epx5nwedrf5y69j FOREIGN KEY (realm_id) REFERENCES public.realm(id);


--
-- Name: realm_events_listeners fk_h846o4h0w8epx5nxev9f5y69j; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.realm_events_listeners
    ADD CONSTRAINT fk_h846o4h0w8epx5nxev9f5y69j FOREIGN KEY (realm_id) REFERENCES public.realm(id);


--
-- Name: identity_provider_mapper fk_idpm_realm; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.identity_provider_mapper
    ADD CONSTRAINT fk_idpm_realm FOREIGN KEY (realm_id) REFERENCES public.realm(id);


--
-- Name: idp_mapper_config fk_idpmconfig; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.idp_mapper_config
    ADD CONSTRAINT fk_idpmconfig FOREIGN KEY (idp_mapper_id) REFERENCES public.identity_provider_mapper(id);


--
-- Name: web_origins fk_lojpho213xcx4wnkog82ssrfy; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.web_origins
    ADD CONSTRAINT fk_lojpho213xcx4wnkog82ssrfy FOREIGN KEY (client_id) REFERENCES public.client(id);


--
-- Name: scope_mapping fk_ouse064plmlr732lxjcn1q5f1; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scope_mapping
    ADD CONSTRAINT fk_ouse064plmlr732lxjcn1q5f1 FOREIGN KEY (client_id) REFERENCES public.client(id);


--
-- Name: protocol_mapper fk_pcm_realm; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.protocol_mapper
    ADD CONSTRAINT fk_pcm_realm FOREIGN KEY (client_id) REFERENCES public.client(id);


--
-- Name: credential fk_pfyr0glasqyl0dei3kl69r6v0; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.credential
    ADD CONSTRAINT fk_pfyr0glasqyl0dei3kl69r6v0 FOREIGN KEY (user_id) REFERENCES public.user_entity(id);


--
-- Name: protocol_mapper_config fk_pmconfig; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.protocol_mapper_config
    ADD CONSTRAINT fk_pmconfig FOREIGN KEY (protocol_mapper_id) REFERENCES public.protocol_mapper(id);


--
-- Name: default_client_scope fk_r_def_cli_scope_realm; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.default_client_scope
    ADD CONSTRAINT fk_r_def_cli_scope_realm FOREIGN KEY (realm_id) REFERENCES public.realm(id);


--
-- Name: required_action_provider fk_req_act_realm; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.required_action_provider
    ADD CONSTRAINT fk_req_act_realm FOREIGN KEY (realm_id) REFERENCES public.realm(id);


--
-- Name: resource_uris fk_resource_server_uris; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resource_uris
    ADD CONSTRAINT fk_resource_server_uris FOREIGN KEY (resource_id) REFERENCES public.resource_server_resource(id);


--
-- Name: role_attribute fk_role_attribute_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_attribute
    ADD CONSTRAINT fk_role_attribute_id FOREIGN KEY (role_id) REFERENCES public.keycloak_role(id);


--
-- Name: realm_supported_locales fk_supported_locales_realm; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.realm_supported_locales
    ADD CONSTRAINT fk_supported_locales_realm FOREIGN KEY (realm_id) REFERENCES public.realm(id);


--
-- Name: user_federation_config fk_t13hpu1j94r2ebpekr39x5eu5; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_federation_config
    ADD CONSTRAINT fk_t13hpu1j94r2ebpekr39x5eu5 FOREIGN KEY (user_federation_provider_id) REFERENCES public.user_federation_provider(id);


--
-- Name: user_group_membership fk_user_group_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_group_membership
    ADD CONSTRAINT fk_user_group_user FOREIGN KEY (user_id) REFERENCES public.user_entity(id);


--
-- Name: policy_config fkdc34197cf864c4e43; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.policy_config
    ADD CONSTRAINT fkdc34197cf864c4e43 FOREIGN KEY (policy_id) REFERENCES public.resource_server_policy(id);


--
-- Name: identity_provider_config fkdc4897cf864c4e43; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.identity_provider_config
    ADD CONSTRAINT fkdc4897cf864c4e43 FOREIGN KEY (identity_provider_id) REFERENCES public.identity_provider(internal_id);


--
-- PostgreSQL database dump complete
--

