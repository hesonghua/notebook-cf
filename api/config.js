async function configHandler(request, env) {
  if (request.method !== 'GET') {
    return Response.json(
      { success: false, message: 'Method Not Allowed' },
      { status: 405 }
    );
  }
  const registerEnabled = env.REGISTER_ENABLED === 'true';
  const turnstileEnabled = env.TURNSTILE_ENABLED === 'true';
  const turnstileSiteKey = turnstileEnabled ? env.TURNSTILE_SITE_KEY : '';
  

  const config = {
    turnstileSiteKey,
    turnstileEnabled,
    registerEnabled,
  };

  return Response.json({
    success: true,
    data: config,
  }, { status: 200 });
}

export default configHandler;