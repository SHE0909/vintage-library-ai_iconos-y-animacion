import { signIn, signUp } from '../data.js';
import { el, showToast } from '../utils.js';
import { icon } from '../icons.js';
import { BACKEND } from '../config.js';

export function renderAuthPage(root, { mode = 'login', navigate }) {
  const isRegister = mode === 'register';
  let errorMsg = '';

  function draw() {
    root.innerHTML = '';
    const errorEl = el('p', { class: 'auth-error' }, errorMsg);

    const nameField = isRegister ? el('div', { class: 'field' }, [
      el('label', {}, 'Nombre'),
      el('input', { class: 'input', name: 'name', required: 'true', placeholder: 'Como quieres que te llamemos' })
    ]) : null;

    const form = el('form', { class: 'auth-form' }, [
      nameField,
      el('div', { class: 'field' }, [
        el('label', {}, 'Correo'),
        el('input', { class: 'input', type: 'email', name: 'email', required: 'true', placeholder: 'tu@correo.com' })
      ]),
      el('div', { class: 'field' }, [
        el('label', {}, 'Contrasena'),
        el('input', { class: 'input', type: 'password', name: 'password', required: 'true', minlength: '4', placeholder: '••••••••' })
      ]),
      errorEl,
      el('button', { class: 'btn btn-gold', type: 'submit' }, isRegister ? 'Crear mi biblioteca' : 'Entrar a mi biblioteca')
    ]);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorMsg = '';
      errorEl.textContent = '';
      const fd = new FormData(form);
      const payload = {
        name: fd.get('name'),
        email: fd.get('email'),
        password: fd.get('password')
      };
      try {
        if (isRegister) {
          await signUp(payload);
          showToast('Cuenta creada. Bienvenido/a a tu biblioteca.');
        } else {
          await signIn(payload);
          showToast('Sesion iniciada.');
        }
        navigate('#/dashboard');
      } catch (err) {
        errorMsg = err.message || 'Ocurrio un error.';
        errorEl.textContent = errorMsg;
      }
    });

    const card = el('div', { class: 'auth-card panel' }, [
      el('p', { class: 'eyebrow' }, 'Vintage Library'),
      el('h1', { class: 'brand' }, [icon('book', { size: 26, className: 'brand-icon' }), el('span', {}, 'Tu biblioteca personal')]),
      el('p', { class: 'tagline' }, isRegister
        ? 'Crea tu cuenta y empieza a construir tu estanteria.'
        : 'Vuelve a tu rincon de lectura.'),
      form,
      el('p', { class: 'auth-switch' }, [
        isRegister ? '¿Ya tienes cuenta? ' : '¿Aun no tienes cuenta? ',
        el('a', {
          href: isRegister ? '#/login' : '#/register'
        }, isRegister ? 'Inicia sesion' : 'Registrate')
      ]),
      BACKEND === 'local'
        ? el('span', { class: 'auth-mode-flag' }, 'Modo demo local — sin backend externo')
        : null
    ]);

    root.appendChild(el('div', { class: 'auth-screen' }, card));
  }

  draw();
}
