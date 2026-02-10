// ================================================
// LIONMATCH - APLICACIÓN PRINCIPAL
// ================================================

// ================================================
// CONFIGURACIÓN DE SUPABASE
// ================================================
const SUPABASE_URL = 'TU_SUPABASE_URL_AQUI';
const SUPABASE_ANON_KEY = 'TU_SUPABASE_ANON_KEY_AQUI';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ================================================
// VARIABLES GLOBALES
// ================================================
let currentUser = null;
let currentScreen = 'login';
let onboardingStep = 1;
let profiles = [];
let currentProfileIndex = 0;
let matches = [];
let conversations = [];

// ================================================
// INICIALIZACIÓN
// ================================================
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

async function initializeApp() {
    // Verificar si hay sesión activa
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
        currentUser = session.user;
        await loadUserProfile();
        
        // Verificar si el perfil está completo
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', currentUser.id)
            .single();
        
        if (profile && profile.name) {
            showScreen('discovery');
            await loadProfiles();
        } else {
            showScreen('onboarding');
        }
    } else {
        showScreen('login');
    }
    
    // Inicializar event listeners
    initializeEventListeners();
}

// ================================================
// EVENT LISTENERS
// ================================================
function initializeEventListeners() {
    // LOGIN
    document.getElementById('login-form')?.addEventListener('submit', handleLogin);
    document.getElementById('go-to-register')?.addEventListener('click', () => showScreen('register'));
    document.getElementById('forgot-password-link')?.addEventListener('click', handleForgotPassword);
    
    // REGISTRO
    document.getElementById('register-form')?.addEventListener('submit', handleRegister);
    document.getElementById('back-to-login')?.addEventListener('click', () => showScreen('login'));
    document.getElementById('cancel-register')?.addEventListener('click', () => showScreen('login'));
    
    // TOGGLE PASSWORD
    document.querySelectorAll('.toggle-password').forEach(btn => {
        btn.addEventListener('click', function() {
            const targetId = this.getAttribute('data-target');
            const input = document.getElementById(targetId);
            
            if (input.type === 'password') {
                input.type = 'text';
                this.classList.add('active');
            } else {
                input.type = 'password';
                this.classList.remove('active');
            }
        });
    });
    
    // ONBOARDING
    document.getElementById('onboarding-form')?.addEventListener('submit', handleCompleteProfile);
    document.getElementById('next-step')?.addEventListener('click', nextOnboardingStep);
    document.getElementById('prev-step')?.addEventListener('click', prevOnboardingStep);
    document.getElementById('back-from-onboarding')?.addEventListener('click', handleLogout);
    
    // Choice buttons para preferencias
    document.querySelectorAll('.choice-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const group = this.parentElement;
            const hiddenInput = group.nextElementSibling;
            
            group.querySelectorAll('.choice-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            hiddenInput.value = this.getAttribute('data-value');
        });
    });
    
    // Bio character counter
    const bioInput = document.getElementById('profile-bio');
    const bioCount = document.getElementById('bio-count');
    bioInput?.addEventListener('input', () => {
        bioCount.textContent = bioInput.value.length;
    });
    
    const editBioInput = document.getElementById('edit-bio');
    const editBioCount = document.getElementById('edit-bio-count');
    editBioInput?.addEventListener('input', () => {
        editBioCount.textContent = editBioInput.value.length;
    });
    
    // DISCOVERY - Botones de acción
    document.getElementById('like-btn')?.addEventListener('click', () => handleSwipe('like'));
    document.getElementById('dislike-btn')?.addEventListener('click', () => handleSwipe('dislike'));
    
    // SIDEBAR
    document.querySelectorAll('#open-menu, #messages-menu-btn, #profile-menu-btn').forEach(btn => {
        btn.addEventListener('click', openSidebar);
    });
    document.getElementById('close-sidebar')?.addEventListener('click', closeSidebar);
    document.getElementById('sidebar-overlay')?.addEventListener('click', closeSidebar);
    
    // Navegación del sidebar
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const screen = item.getAttribute('data-screen');
            showScreen(screen);
            closeSidebar();
            
            if (screen === 'discovery') {
                loadProfiles();
            } else if (screen === 'messages') {
                loadMatches();
                loadConversations();
            } else if (screen === 'profile') {
                displayUserProfile();
            }
        });
    });
    
    // PERFIL
    document.getElementById('edit-profile-btn')?.addEventListener('click', () => {
        populateEditForm();
        showScreen('edit-profile');
    });
    document.getElementById('delete-account-btn')?.addEventListener('click', () => {
        document.getElementById('delete-modal').classList.add('active');
    });
    document.getElementById('confirm-delete')?.addEventListener('click', handleDeleteAccount);
    document.getElementById('cancel-delete')?.addEventListener('click', () => {
        document.getElementById('delete-modal').classList.remove('active');
    });
    
    // EDITAR PERFIL
    document.getElementById('edit-profile-form')?.addEventListener('submit', handleUpdateProfile);
    document.getElementById('back-from-edit')?.addEventListener('click', () => showScreen('profile'));
    document.getElementById('cancel-edit')?.addEventListener('click', () => showScreen('profile'));
    
    // CHAT
    document.getElementById('back-from-chat')?.addEventListener('click', () => showScreen('messages'));
    document.getElementById('send-message-btn')?.addEventListener('click', handleSendMessage);
    document.getElementById('chat-input')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleSendMessage();
        }
    });
    
    // LOGOUT
    document.getElementById('logout-btn')?.addEventListener('click', handleLogout);
    
    // MODALES
    document.getElementById('close-match-modal')?.addEventListener('click', () => {
        document.getElementById('match-modal').classList.remove('active');
    });
    document.getElementById('send-match-message')?.addEventListener('click', () => {
        document.getElementById('match-modal').classList.remove('active');
        showScreen('chat');
    });
}

// ================================================
// AUTENTICACIÓN
// ================================================
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const ageConfirmation = document.getElementById('age-confirmation').checked;
    
    if (!ageConfirmation) {
        showToast('Debes confirmar que eres mayor de edad', 'error');
        return;
    }
    
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        
        if (error) throw error;
        
        currentUser = data.user;
        await loadUserProfile();
        
        showToast('¡Bienvenido de nuevo!', 'success');
        showScreen('discovery');
        await loadProfiles();
    } catch (error) {
        console.error('Error en login:', error);
        showToast('Email o contraseña incorrectos', 'error');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const passwordConfirm = document.getElementById('register-password-confirm').value;
    
    // Validar que las contraseñas coincidan
    if (password !== passwordConfirm) {
        showToast('Las contraseñas no coinciden', 'error');
        return;
    }
    
    if (password.length < 6) {
        showToast('La contraseña debe tener al menos 6 caracteres', 'error');
        return;
    }
    
    try {
        // Verificar si el usuario ya existe
        const { data: existingUser } = await supabase
            .from('profiles')
            .select('user_id')
            .eq('email', email)
            .single();
        
        if (existingUser) {
            showToast('Este correo ya está registrado', 'error');
            return;
        }
        
        const { data, error } = await supabase.auth.signUp({
            email,
            password
        });
        
        if (error) throw error;
        
        currentUser = data.user;
        
        // Crear perfil inicial
        await supabase.from('profiles').insert({
            user_id: currentUser.id,
            email: email,
            created_at: new Date().toISOString()
        });
        
        showToast('¡Cuenta creada! Completa tu perfil', 'success');
        showScreen('onboarding');
    } catch (error) {
        console.error('Error en registro:', error);
        showToast('Error al crear la cuenta', 'error');
    }
}

async function handleForgotPassword(e) {
    e.preventDefault();
    const email = prompt('Ingresa tu correo electrónico:');
    
    if (!email) return;
    
    try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin
        });
        
        if (error) throw error;
        
        showToast('Te enviamos un email para restablecer tu contraseña', 'success');
    } catch (error) {
        console.error('Error:', error);
        showToast('Error al enviar el email', 'error');
    }
}

async function handleLogout() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        
        currentUser = null;
        showScreen('login');
        showToast('Sesión cerrada', 'success');
    } catch (error) {
        console.error('Error al cerrar sesión:', error);
        showToast('Error al cerrar sesión', 'error');
    }
}

// ================================================
// ONBOARDING - COMPLETAR PERFIL
// ================================================
function nextOnboardingStep() {
    // Validar el paso actual
    const currentStepElement = document.querySelector(`.form-step[data-step="${onboardingStep}"]`);
    const inputs = currentStepElement.querySelectorAll('input[required], select[required]');
    
    let isValid = true;
    inputs.forEach(input => {
        if (!input.value) {
            isValid = false;
            input.style.borderColor = 'var(--danger)';
            setTimeout(() => {
                input.style.borderColor = '';
            }, 2000);
        }
    });
    
    if (!isValid) {
        showToast('Completa todos los campos requeridos', 'error');
        return;
    }
    
    if (onboardingStep < 3) {
        onboardingStep++;
        updateOnboardingUI();
    }
}

function prevOnboardingStep() {
    if (onboardingStep > 1) {
        onboardingStep--;
        updateOnboardingUI();
    }
}

function updateOnboardingUI() {
    // Actualizar pasos
    document.querySelectorAll('.form-step').forEach(step => {
        step.classList.remove('active');
    });
    document.querySelector(`.form-step[data-step="${onboardingStep}"]`).classList.add('active');
    
    // Actualizar barra de progreso
    const progress = (onboardingStep / 3) * 100;
    document.getElementById('onboarding-progress').style.width = `${progress}%`;
    
    // Mostrar/ocultar botones
    document.getElementById('prev-step').style.display = onboardingStep > 1 ? 'block' : 'none';
    document.getElementById('next-step').style.display = onboardingStep < 3 ? 'block' : 'none';
    document.getElementById('complete-profile').style.display = onboardingStep === 3 ? 'block' : 'none';
}

async function handleCompleteProfile(e) {
    e.preventDefault();
    
    const name = document.getElementById('profile-name').value;
    const birthdate = document.getElementById('profile-birthdate').value;
    const gender = document.getElementById('profile-gender').value;
    const seeking = document.getElementById('profile-seeking').value;
    const bio = document.getElementById('profile-bio').value || '';
    const interests = document.getElementById('profile-interests').value || '';
    
    // Calcular edad
    const age = calculateAge(birthdate);
    
    if (age < 18) {
        showToast('Debes ser mayor de 18 años', 'error');
        return;
    }
    
    if (!seeking) {
        showToast('Selecciona qué buscas', 'error');
        return;
    }
    
    try {
        const { error } = await supabase
            .from('profiles')
            .update({
                name,
                birthdate,
                age,
                gender,
                seeking,
                bio,
                interests,
                location: 'León, Guanajuato',
                updated_at: new Date().toISOString()
            })
            .eq('user_id', currentUser.id);
        
        if (error) throw error;
        
        await loadUserProfile();
        showToast('¡Perfil completado!', 'success');
        showScreen('discovery');
        await loadProfiles();
    } catch (error) {
        console.error('Error al completar perfil:', error);
        showToast('Error al guardar el perfil', 'error');
    }
}

// ================================================
// PERFIL DE USUARIO
// ================================================
async function loadUserProfile() {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', currentUser.id)
            .single();
        
        if (error) throw error;
        
        currentUser.profile = data;
    } catch (error) {
        console.error('Error al cargar perfil:', error);
    }
}

function displayUserProfile() {
    const profile = currentUser.profile;
    
    document.getElementById('profile-display-name').textContent = profile.name;
    document.getElementById('profile-display-age').textContent = `${profile.age} años`;
    document.getElementById('profile-display-bio').textContent = profile.bio || 'Sin biografía';
    document.getElementById('profile-display-interests').textContent = profile.interests || 'Sin intereses';
    document.getElementById('profile-display-seeking').textContent = profile.seeking || 'No especificado';
}

function populateEditForm() {
    const profile = currentUser.profile;
    
    document.getElementById('edit-name').value = profile.name || '';
    document.getElementById('edit-bio').value = profile.bio || '';
    document.getElementById('edit-interests').value = profile.interests || '';
    document.getElementById('edit-seeking').value = profile.seeking || '';
    
    // Actualizar contador de caracteres
    document.getElementById('edit-bio-count').textContent = (profile.bio || '').length;
    
    // Marcar botón activo
    document.querySelectorAll('#edit-profile-screen .choice-btn').forEach(btn => {
        if (btn.getAttribute('data-value') === profile.seeking) {
            btn.classList.add('active');
        }
    });
}

async function handleUpdateProfile(e) {
    e.preventDefault();
    
    const name = document.getElementById('edit-name').value;
    const bio = document.getElementById('edit-bio').value;
    const interests = document.getElementById('edit-interests').value;
    const seeking = document.getElementById('edit-seeking').value;
    
    if (!seeking) {
        showToast('Selecciona qué buscas', 'error');
        return;
    }
    
    try {
        const { error } = await supabase
            .from('profiles')
            .update({
                name,
                bio,
                interests,
                seeking,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', currentUser.id);
        
        if (error) throw error;
        
        await loadUserProfile();
        showToast('Perfil actualizado', 'success');
        showScreen('profile');
        displayUserProfile();
    } catch (error) {
        console.error('Error al actualizar perfil:', error);
        showToast('Error al actualizar el perfil', 'error');
    }
}

async function handleDeleteAccount() {
    try {
        // Eliminar perfil
        await supabase
            .from('profiles')
            .delete()
            .eq('user_id', currentUser.id);
        
        // Eliminar likes, matches, etc.
        await supabase
            .from('likes')
            .delete()
            .or(`user_id.eq.${currentUser.id},liked_user_id.eq.${currentUser.id}`);
        
        await supabase
            .from('matches')
            .delete()
            .or(`user1_id.eq.${currentUser.id},user2_id.eq.${currentUser.id}`);
        
        await supabase
            .from('messages')
            .delete()
            .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`);
        
        // Eliminar cuenta de autenticación
        const { error } = await supabase.auth.admin.deleteUser(currentUser.id);
        
        if (error) throw error;
        
        showToast('Cuenta eliminada', 'success');
        currentUser = null;
        document.getElementById('delete-modal').classList.remove('active');
        showScreen('login');
    } catch (error) {
        console.error('Error al eliminar cuenta:', error);
        showToast('Error al eliminar la cuenta. Contacta a soporte.', 'error');
    }
}

// ================================================
// DESCUBRIMIENTO - CARGAR PERFILES
// ================================================
async function loadProfiles() {
    try {
        const myProfile = currentUser.profile;
        
        // Obtener IDs de usuarios que ya hemos dado like o dislike
        const { data: likedUsers } = await supabase
            .from('likes')
            .select('liked_user_id')
            .eq('user_id', currentUser.id);
        
        const likedIds = likedUsers ? likedUsers.map(l => l.liked_user_id) : [];
        likedIds.push(currentUser.id); // Excluir nuestro propio perfil
        
        // Obtener perfiles según preferencias
        let query = supabase
            .from('profiles')
            .select('*')
            .eq('location', 'León, Guanajuato')
            .not('user_id', 'in', `(${likedIds.join(',')})`);
        
        // Filtrar por género preferido
        if (myProfile.seeking !== 'Todos') {
            query = query.eq('gender', myProfile.seeking === 'Hombres' ? 'Hombre' : 'Mujer');
        }
        
        const { data, error } = await query.limit(20);
        
        if (error) throw error;
        
        profiles = data || [];
        currentProfileIndex = 0;
        renderCurrentProfile();
    } catch (error) {
        console.error('Error al cargar perfiles:', error);
        showToast('Error al cargar perfiles', 'error');
    }
}

function renderCurrentProfile() {
    const cardsStack = document.getElementById('cards-stack');
    cardsStack.innerHTML = '';
    
    if (currentProfileIndex >= profiles.length) {
        document.getElementById('no-more-cards').style.display = 'flex';
        return;
    }
    
    const profile = profiles[currentProfileIndex];
    
    const card = document.createElement('div');
    card.className = 'profile-card-swipe';
    card.innerHTML = `
        <img src="https://i.pravatar.cc/400?u=${profile.user_id}" alt="${profile.name}">
        <div class="profile-card-info">
            <h3>${profile.name}, ${profile.age}</h3>
            <p>${profile.bio || 'Sin biografía'}</p>
        </div>
        <div class="swipe-indicator like">LIKE</div>
        <div class="swipe-indicator nope">NOPE</div>
    `;
    
    cardsStack.appendChild(card);
    
    // Implementar swipe con mouse/touch
    let startX = 0;
    let currentX = 0;
    let isDragging = false;
    
    card.addEventListener('mousedown', startDrag);
    card.addEventListener('touchstart', startDrag);
    card.addEventListener('mousemove', drag);
    card.addEventListener('touchmove', drag);
    card.addEventListener('mouseup', endDrag);
    card.addEventListener('touchend', endDrag);
    card.addEventListener('mouseleave', endDrag);
    
    function startDrag(e) {
        isDragging = true;
        startX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        card.style.transition = 'none';
    }
    
    function drag(e) {
        if (!isDragging) return;
        
        currentX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        const diff = currentX - startX;
        
        card.style.transform = `translateX(${diff}px) rotate(${diff * 0.1}deg)`;
        
        const likeIndicator = card.querySelector('.swipe-indicator.like');
        const nopeIndicator = card.querySelector('.swipe-indicator.nope');
        
        if (diff > 50) {
            likeIndicator.classList.add('show');
            nopeIndicator.classList.remove('show');
        } else if (diff < -50) {
            nopeIndicator.classList.add('show');
            likeIndicator.classList.remove('show');
        } else {
            likeIndicator.classList.remove('show');
            nopeIndicator.classList.remove('show');
        }
    }
    
    function endDrag() {
        if (!isDragging) return;
        
        isDragging = false;
        const diff = currentX - startX;
        
        card.style.transition = 'transform 0.3s ease';
        
        if (diff > 100) {
            handleSwipe('like', card);
        } else if (diff < -100) {
            handleSwipe('dislike', card);
        } else {
            card.style.transform = '';
            card.querySelector('.swipe-indicator.like').classList.remove('show');
            card.querySelector('.swipe-indicator.nope').classList.remove('show');
        }
    }
}

async function handleSwipe(action, cardElement = null) {
    const profile = profiles[currentProfileIndex];
    
    if (!cardElement) {
        cardElement = document.querySelector('.profile-card-swipe');
    }
    
    // Animar salida
    if (action === 'like') {
        cardElement.style.transform = 'translateX(150%) rotate(30deg)';
    } else {
        cardElement.style.transform = 'translateX(-150%) rotate(-30deg)';
    }
    
    setTimeout(() => {
        currentProfileIndex++;
        renderCurrentProfile();
    }, 300);
    
    // Guardar acción en base de datos
    try {
        await supabase.from('likes').insert({
            user_id: currentUser.id,
            liked_user_id: profile.user_id,
            is_like: action === 'like',
            created_at: new Date().toISOString()
        });
        
        if (action === 'like') {
            // Verificar si hay match
            const { data: reciprocalLike } = await supabase
                .from('likes')
                .select('*')
                .eq('user_id', profile.user_id)
                .eq('liked_user_id', currentUser.id)
                .eq('is_like', true)
                .single();
            
            if (reciprocalLike) {
                // ¡Es un match!
                await createMatch(profile);
                showMatchModal(profile);
            }
        }
    } catch (error) {
        console.error('Error al guardar like:', error);
    }
}

async function createMatch(profile) {
    try {
        await supabase.from('matches').insert({
            user1_id: currentUser.id,
            user2_id: profile.user_id,
            created_at: new Date().toISOString()
        });
        
        showToast('¡Es un Match!', 'success');
    } catch (error) {
        console.error('Error al crear match:', error);
    }
}

function showMatchModal(profile) {
    const modal = document.getElementById('match-modal');
    const photo = document.getElementById('match-user-photo');
    
    photo.src = `https://i.pravatar.cc/150?u=${profile.user_id}`;
    modal.classList.add('active');
}

// ================================================
// MENSAJES Y CHAT
// ================================================
async function loadMatches() {
    try {
        const { data, error } = await supabase
            .from('matches')
            .select(`
                *,
                user1:profiles!matches_user1_id_fkey(*),
                user2:profiles!matches_user2_id_fkey(*)
            `)
            .or(`user1_id.eq.${currentUser.id},user2_id.eq.${currentUser.id}`)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        matches = data || [];
        renderMatches();
    } catch (error) {
        console.error('Error al cargar matches:', error);
    }
}

function renderMatches() {
    const carousel = document.getElementById('matches-carousel');
    carousel.innerHTML = '';
    
    matches.forEach(match => {
        const otherUser = match.user1_id === currentUser.id ? match.user2 : match.user1;
        
        const matchDiv = document.createElement('div');
        matchDiv.className = 'match-item';
        matchDiv.innerHTML = `
            <img src="https://i.pravatar.cc/100?u=${otherUser.user_id}" alt="${otherUser.name}" class="match-avatar">
            <div class="match-name">${otherUser.name}</div>
        `;
        
        matchDiv.addEventListener('click', () => {
            openChat(otherUser);
        });
        
        carousel.appendChild(matchDiv);
    });
}

async function loadConversations() {
    try {
        // Obtener últimos mensajes de cada conversación
        const { data, error } = await supabase
            .from('messages')
            .select(`
                *,
                sender:profiles!messages_sender_id_fkey(*),
                receiver:profiles!messages_receiver_id_fkey(*)
            `)
            .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
            .order('created_at', { ascending: false })
            .limit(50);
        
        if (error) throw error;
        
        // Agrupar por conversación
        const conversationsMap = new Map();
        
        data?.forEach(msg => {
            const otherUserId = msg.sender_id === currentUser.id ? msg.receiver_id : msg.sender_id;
            
            if (!conversationsMap.has(otherUserId)) {
                conversationsMap.set(otherUserId, {
                    user: msg.sender_id === currentUser.id ? msg.receiver : msg.sender,
                    lastMessage: msg.content,
                    time: formatTime(msg.created_at),
                    online: Math.random() > 0.5 // Simulado
                });
            }
        });
        
        conversations = Array.from(conversationsMap.values());
        renderConversations();
    } catch (error) {
        console.error('Error al cargar conversaciones:', error);
    }
}

function renderConversations() {
    const list = document.getElementById('conversations-list');
    
    if (conversations.length === 0) {
        list.innerHTML = `
            <div class="empty-state" id="empty-messages">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                <h3>Sin mensajes aún</h3>
                <p>Tus conversaciones aparecerán aquí</p>
            </div>
        `;
        return;
    }
    
    list.innerHTML = '';
    
    conversations.forEach(conv => {
        const convDiv = document.createElement('div');
        convDiv.className = 'conversation-item';
        convDiv.innerHTML = `
            <div class="conversation-avatar-wrapper">
                <img src="https://i.pravatar.cc/100?u=${conv.user.user_id}" alt="${conv.user.name}" class="conversation-avatar">
                ${conv.online ? '<div class="online-indicator"></div>' : ''}
            </div>
            <div class="conversation-info">
                <div class="conversation-header">
                    <span class="conversation-name">${conv.user.name}</span>
                    <span class="conversation-time">${conv.time}</span>
                </div>
                <p class="conversation-message">${conv.lastMessage}</p>
            </div>
        `;
        
        convDiv.addEventListener('click', () => {
            openChat(conv.user);
        });
        
        list.appendChild(convDiv);
    });
}

function openChat(user) {
    showScreen('chat');
    
    document.getElementById('chat-user-avatar').src = `https://i.pravatar.cc/100?u=${user.user_id}`;
    document.getElementById('chat-user-name').textContent = user.name;
    
    loadChatMessages(user.user_id);
}

async function loadChatMessages(otherUserId) {
    try {
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${currentUser.id})`)
            .order('created_at', { ascending: true });
        
        if (error) throw error;
        
        renderChatMessages(data || []);
    } catch (error) {
        console.error('Error al cargar mensajes:', error);
    }
}

function renderChatMessages(messages) {
    const container = document.getElementById('chat-messages');
    container.innerHTML = '';
    
    messages.forEach(msg => {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${msg.sender_id === currentUser.id ? 'sent' : 'received'}`;
        messageDiv.innerHTML = `
            <div class="message-bubble">${msg.content}</div>
        `;
        container.appendChild(messageDiv);
    });
    
    // Scroll al final
    container.scrollTop = container.scrollHeight;
}

async function handleSendMessage() {
    const input = document.getElementById('chat-input');
    const content = input.value.trim();
    
    if (!content) return;
    
    // Obtener el ID del otro usuario (simplificado, en producción deberías guardarlo)
    const chatUserName = document.getElementById('chat-user-name').textContent;
    const otherUser = conversations.find(c => c.user.name === chatUserName)?.user;
    
    if (!otherUser) return;
    
    try {
        const { error } = await supabase.from('messages').insert({
            sender_id: currentUser.id,
            receiver_id: otherUser.user_id,
            content,
            created_at: new Date().toISOString()
        });
        
        if (error) throw error;
        
        input.value = '';
        loadChatMessages(otherUser.user_id);
    } catch (error) {
        console.error('Error al enviar mensaje:', error);
        showToast('Error al enviar mensaje', 'error');
    }
}

// ================================================
// UTILIDADES
// ================================================
function showScreen(screenId) {
    // Ocultar todas las pantallas
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    // Mostrar la pantalla solicitada
    document.getElementById(`${screenId}-screen`).classList.add('active');
    currentScreen = screenId;
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function openSidebar() {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('sidebar-overlay').classList.add('active');
}

function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('active');
}

function calculateAge(birthdate) {
    const today = new Date();
    const birth = new Date(birthdate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    
    return age;
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    
    return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}
