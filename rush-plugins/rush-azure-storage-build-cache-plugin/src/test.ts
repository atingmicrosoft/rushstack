import { DeviceCodeCredential } from '@azure/identity';
import { ITerminal } from '@rushstack/node-core-library';
import { IAzureAuthenticationConfiguration, ICredentialResultWithId } from './RushAzureInteractiveAuthPlugin';

async function fetchCredentialsUsingDeviceCodeAsync(
  deviceCodeCredential: DeviceCodeCredential,
  terminal: ITerminal,
  options: IAzureAuthenticationConfiguration
): Promise<ICredentialResultWithId> {
  const { keyVaultSecretName = '' } = options;

  // const keyVaultCredential: KeyVaultAuthentication = new KeyVaultAuthentication({
  //   vaultName: keyVaultName,
  //   secretName: keyVaultSecretName,
  //   deviceCodeCredentails: deviceCodeCredential
  // });

  // const keyVaultCoreCredentials: ICredentialResult =
  //   await keyVaultCredential._getCredentialFromDeviceCodeAsync(terminal, deviceCodeCredential);
  const keyVaultCacheId: string = `azure-key-vault|AzurePublicCloud|odsp-web-tests|${keyVaultSecretName}`;

  return {
    credentialId: keyVaultCacheId,
    credential: {
      credentialString: 'succesafjoisaef'
    }
  };
}

export { fetchCredentialsUsingDeviceCodeAsync };
