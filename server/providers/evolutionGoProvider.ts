type EvolutionConfiguration = {
  configured: boolean;
  apiUrl?: string;
  apiKey?: string;
  instanceName?: string;
};

export function getEvolutionConfiguration(): EvolutionConfiguration {
  const apiUrl = process.env.EVOLUTION_API_URL?.trim().replace(/\/+$/, '');
  const apiKey = process.env.EVOLUTION_API_KEY?.trim();
  const instanceName = process.env.EVOLUTION_INSTANCE_NAME?.trim();
  return {
    configured: Boolean(apiUrl && apiKey && instanceName),
    apiUrl,
    apiKey,
    instanceName,
  };
}

export async function getEvolutionGoStatus() {
  const configuration = getEvolutionConfiguration();
  return {
    configured: configuration.configured,
    available: false,
    instanceConnected: false,
  };
}
