import { LifiStep } from '@lifi/types'
import { Signer } from 'ethers'
import { SwitchChainHook } from '../types'
import { LifiErrorCode, ProviderError } from '../utils/errors'
import { StatusManager } from './StatusManager'

/**
 * This method checks whether the signer is configured for the correct chain.
 * If yes it returns the signer.
 * If no and if user interaction is allowed it triggers the switchChainHook. If no user interaction is allowed it aborts.
 *
 * @param signer
 * @param statusManager
 * @param step
 * @param switchChainHook
 * @param allowUserInteraction
 */
export const switchChain = async (
  signer: Signer,
  statusManager: StatusManager,
  step: LifiStep,
  switchChainHook: SwitchChainHook,
  allowUserInteraction: boolean
): Promise<Signer | undefined> => {
  // if we are already on the correct chain we can proceed directly
  if ((await signer.getChainId()) === step.action.fromChainId) {
    return signer
  }

  // -> set status message
  step.execution = statusManager.initExecutionObject(step)
  statusManager.updateExecution(step, 'ACTION_REQUIRED')

  let switchProcess = statusManager.findOrCreateProcess(
    step,
    'SWITCH_CHAIN',
    'ACTION_REQUIRED'
  )

  if (!allowUserInteraction) {
    return
  }

  try {
    const updatedSigner = await switchChainHook(step.action.fromChainId)
    const updatedChainId = await updatedSigner?.getChainId()
    if (updatedChainId !== step.action.fromChainId) {
      throw new ProviderError(
        LifiErrorCode.ChainSwitchError,
        'Chain switch required.'
      )
    }

    switchProcess = statusManager.updateProcess(
      step,
      switchProcess.type,
      'DONE'
    )
    statusManager.updateExecution(step, 'PENDING')
    return updatedSigner
  } catch (error: any) {
    statusManager.updateProcess(step, switchProcess.type, 'FAILED', {
      error: {
        message: error.message,
        code: LifiErrorCode.ChainSwitchError,
      },
    })
    statusManager.updateExecution(step, 'FAILED')
    throw error
  }
}
