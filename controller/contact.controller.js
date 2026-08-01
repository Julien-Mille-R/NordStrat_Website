import { ContactMessage } from '../models/index.js';
import { setFlash } from './access.controller.js';

function normalizedText(value) {
  return value?.trim() || '';
}

export function showContactPage(req, res) {
  return res.render('layouts/contact');
}

export async function sendContactMessage(req, res, next) {
  const authorName = normalizedText(req.body.authorName);
  const email = normalizedText(req.body.email).toLowerCase();
  const phone = normalizedText(req.body.phone) || null;
  const subject = normalizedText(req.body.subject);
  const message = normalizedText(req.body.message);

  try {
    if (req.body.website) {
      setFlash(req, 'success', 'Votre message a bien été envoyé.');
      return res.redirect('/contact');
    }
    const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const phoneIsValid = !phone || /^[0-9+().\s-]{6,30}$/.test(phone);
    const invalidFields = authorName.length < 2
      || authorName.length > 100
      || !emailIsValid
      || !phoneIsValid
      || subject.length < 3
      || subject.length > 150
      || message.length < 20
      || message.length > 5000;
    if (invalidFields) {
      setFlash(req, 'error', 'Vérifiez les informations du formulaire et la longueur du message.');
      return res.redirect('/contact');
    }

    await ContactMessage.create({
      playerId: req.currentUser?.id || null,
      authorName,
      email,
      phone,
      subject,
      message,
    });
    setFlash(req, 'success', 'Votre message a bien été envoyé à l’association.');
    return res.redirect('/contact');
  } catch (error) {
    if (error.name === 'SequelizeValidationError') {
      setFlash(req, 'error', 'Impossible d’envoyer ce message. Vérifiez les informations saisies.');
      return res.redirect('/contact');
    }
    return next(error);
  }
}
