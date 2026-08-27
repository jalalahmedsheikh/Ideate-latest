import * as tf from "@tensorflow/tfjs";

// Ensure TensorFlow.js is initialized
console.log("🧠 Initializing TensorFlow.js Engine (Backend Version:", tf.version.tfjs, ")");

/**
 * Execute a tensor computation inside a clean tidy scope to prevent tensor leaks.
 * @param {Function} fn Function executing tensor operations returning a result
 * @returns {any} Result of fn
 */
export const safeTidy = (fn) => {
  return tf.tidy(fn);
};

/**
 * Perform inference on a model with safety guarantees, tensor cleanup, and fallback.
 * @param {tf.LayersModel} model TensorFlow.js model instance
 * @param {tf.Tensor|Array} inputData Input tensor or JS array
 * @param {Function} fallbackFn Fallback calculation function if inference fails
 * @returns {Promise<Array>} Prediction result array
 */
export const safePredict = async (model, inputData, fallbackFn = null) => {
  if (!model) {
    if (fallbackFn) return await fallbackFn();
    throw new Error("Model is uninitialized and no fallback provided.");
  }

  let inputTensor = null;
  let outputTensor = null;

  try {
    inputTensor = inputData instanceof tf.Tensor ? inputData : tf.tensor(inputData);
    outputTensor = model.predict(inputTensor);

    let results;
    if (Array.isArray(outputTensor)) {
      results = await Promise.all(outputTensor.map((t) => t.data()));
    } else {
      results = await outputTensor.data();
    }

    return Array.from(results);
  } catch (error) {
    console.warn("⚠️ [safePredict] TF.js prediction failed:", error.message);
    if (fallbackFn) {
      return await fallbackFn();
    }
    throw error;
  } finally {
    // Explicitly dispose allocated tensors to ensure 0 memory leaks
    if (inputTensor && inputTensor !== inputData) {
      inputTensor.dispose();
    }
    if (outputTensor) {
      if (Array.isArray(outputTensor)) {
        outputTensor.forEach((t) => t.dispose());
      } else {
        outputTensor.dispose();
      }
    }
  }
};

/**
 * Returns current TensorFlow.js memory profile
 */
export const getMemoryProfile = () => {
  const memoryInfo = tf.memory();
  return {
    numTensors: memoryInfo.numTensors,
    numDataBuffers: memoryInfo.numDataBuffers,
    numBytes: memoryInfo.numBytes,
    unreliable: memoryInfo.unreliable || false,
  };
};

export { tf };
