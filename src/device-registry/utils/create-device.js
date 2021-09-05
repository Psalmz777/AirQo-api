"use strict";
const HTTPStatus = require("http-status");
const DeviceSchema = require("../models/Device");
const { getModelByTenant } = require("./multitenancy");
const axios = require("axios");
const { logObject, logElement, logText } = require("./log");
const deleteChannel = require("./delete-channel");
const { transform } = require("node-json-transform");
const constants = require("../config/constants");
const cryptoJS = require("crypto-js");
const generateFilter = require("./generate-filter");
const { utillErrors } = require("./errors");
const jsonify = require("./jsonify");
const isEmpty = require("is-empty");
const log4js = require("log4js");
const logger = log4js.getLogger("create-device-util");
const qs = require("qs");
const { logger_v2 } = require("../utils/errors");
const QRCode = require("qrcode");

const registerDeviceUtil = {
  generateQR: async (request) => {
    try {
      let { include_site } = request.query;
      let responseFromListDevice = await registerDeviceUtil.list(request);
      if (responseFromListDevice.success) {
        let deviceBody = responseFromListDevice.data;
        if (!isEmpty(include_site) && include_site === "no") {
          logger.info(`the site details have been removed from the data`);
          delete deviceBody.site;
        }
        logger.info(`deviceBody -- ${deviceBody}`);
        let responseFromQRCode = await QRCode.toDataURL(deviceBody);
        logger.info(`responseFromQRCode -- ${responseFromQRCode}`);
        if (!isEmpty(responseFromQRCode)) {
          return {
            success: true,
            message: "successfully generated the QR Code",
            data: responseFromQRCode,
          };
        }
        return {
          success: false,
          message: "unable to generate the QR code",
        };
      }

      if (!responseFromListDevice.success) {
        let errors = responseFromListDevice.errors
          ? responseFromListDevice.errors
          : "";
        return {
          success: false,
          message: responseFromListDevice.message,
          errors,
        };
      }
    } catch (err) {
      logger.error(`server side error -- ${err.message}`);
      return {
        success: false,
        message: "unable to generate the QR code --server side error",
        errors: err.message,
      };
    }
  },
  create: async (request) => {
    try {
      if (request.query.tenant !== "airqo") {
        return {
          success: false,
          message: "creation is not yet possible for this organisation",
        };
      }
      let responseFromCreateOnThingspeak = await registerDeviceUtil.createOnThingSpeak(
        request
      );

      logger.info(
        `responseFromCreateOnThingspeak -- ${jsonify(
          responseFromCreateOnThingspeak
        )}`
      );

      let enrichmentDataForDeviceCreation = responseFromCreateOnThingspeak.data
        ? responseFromCreateOnThingspeak.data
        : {};
      logger.info(
        `enrichmentDataForDeviceCreation -- ${jsonify(
          enrichmentDataForDeviceCreation
        )}`
      );

      if (!isEmpty(enrichmentDataForDeviceCreation)) {
        let modifiedRequest = request;
        modifiedRequest["body"] = {
          ...request.body,
          ...enrichmentDataForDeviceCreation,
        };

        let responseFromCreateDeviceOnPlatform = await registerDeviceUtil.createOnPlatform(
          modifiedRequest
        );

        if (responseFromCreateDeviceOnPlatform.success === true) {
          logger.info(
            `successfully create the device --  ${jsonify(
              responseFromCreateDeviceOnPlatform.data
            )}`
          );
          return {
            success: true,
            message: responseFromCreateDeviceOnPlatform.message,
            data: responseFromCreateDeviceOnPlatform.data,
            status: responseFromCreateDeviceOnPlatform.status,
          };
        }

        if (responseFromCreateDeviceOnPlatform.success === false) {
          let deleteRequest = {};
          deleteRequest["query"] = {};
          deleteRequest["query"]["device_number"] =
            enrichmentDataForDeviceCreation.device_number;
          logger.info(`deleteRequest -- ${jsonify(deleteRequest)}`);
          let responseFromDeleteDeviceFromThingspeak = await registerDeviceUtil.deleteOnThingspeak(
            deleteRequest
          );

          logger.info(
            ` responseFromDeleteDeviceFromThingspeak -- ${jsonify(
              responseFromDeleteDeviceFromThingspeak
            )}`
          );

          if (responseFromDeleteDeviceFromThingspeak.success === true) {
            let errors = responseFromCreateDeviceOnPlatform.errors
              ? responseFromCreateDeviceOnPlatform.errors
              : "";
            logger.error(
              `creation operation failed -- successfully undid the successfull operations -- ${errors}`
            );
            return {
              success: false,
              message:
                "creation operation failed -- successfully undid the successfull operations",
              errors,
            };
          }

          if (responseFromDeleteDeviceFromThingspeak.success === false) {
            let errors = responseFromDeleteDeviceFromThingspeak.errors
              ? responseFromDeleteDeviceFromThingspeak.errors
              : "";
            logger.error(
              `creation operation failed -- also failed to undo the successfull operations --${errors}`
            );
            return {
              success: false,
              message:
                "creation operation failed -- also failed to undo the successfull operations",
              errors,
            };
          }
        }
      }

      if (isEmpty(enrichmentDataForDeviceCreation)) {
        let errors = responseFromCreateOnThingspeak.errors
          ? responseFromCreateOnThingspeak.errors
          : "";
        logger.error(
          `unable to generate enrichment data for the device -- ${errors}`
        );
        return {
          success: false,
          message: "unable to generate enrichment data for the device",
          errors,
        };
      }
    } catch (error) {
      logger.error(`create -- ${error.message}`);
      return {
        success: false,
        message: "server error",
        errors: error.message,
      };
    }
  },
  update: async (request) => {
    try {
      logger.info(`in the update util....`);
      const { device_number } = request.query;
      let modifiedRequest = request;
      if (isEmpty(device_number)) {
        logger.info(`the device_number is not present`);
        let responseFromListDevice = await registerDeviceUtil.list(request);
        logger.info(
          `responseFromListDevice -- ${jsonify(responseFromListDevice)}`
        );
        if (responseFromListDevice.success === false) {
          let errors = responseFromListDevice.errors
            ? responseFromListDevice.errors
            : "";
          return {
            success: false,
            message: responseFromListDevice.message,
            errors,
          };
        }
        let device_number = responseFromListDevice.data[0].device_number;
        logger.info(`device_number -- ${device_number}`);
        modifiedRequest["query"]["device_number"] = device_number;
      }
      logger.info(`the modifiedRequest -- ${modifiedRequest} `);
      logObject("the UnmodifiedRequest ", jsonify(request));
      let responseFromUpdateDeviceOnThingspeak = await registerDeviceUtil.updateOnThingspeak(
        modifiedRequest
      );
      logger.info(
        `responseFromUpdateDeviceOnThingspeak -- ${jsonify(
          responseFromUpdateDeviceOnThingspeak
        )}`
      );
      if (responseFromUpdateDeviceOnThingspeak.success === true) {
        let responseFromUpdateDeviceOnPlatform = await registerDeviceUtil.updateOnPlatform(
          request
        );
        logger.info(
          `responseFromUpdateDeviceOnPlatform -- ${jsonify(
            responseFromUpdateDeviceOnPlatform
          )}`
        );
        if (responseFromUpdateDeviceOnPlatform.success === true) {
          return {
            success: true,
            message: responseFromUpdateDeviceOnPlatform.message,
            data: responseFromUpdateDeviceOnPlatform.data,
          };
        }
        if (responseFromUpdateDeviceOnPlatform.success === false) {
          let errors = responseFromUpdateDeviceOnPlatform.errors
            ? responseFromUpdateDeviceOnPlatform.errors
            : "";
          return {
            success: false,
            message: responseFromUpdateDeviceOnPlatform.message,
            errors,
          };
        }
      }

      if (responseFromUpdateDeviceOnThingspeak.success === false) {
        let errors = responseFromUpdateDeviceOnThingspeak.errors
          ? responseFromUpdateDeviceOnThingspeak.errors
          : "";
        return {
          success: false,
          message: responseFromUpdateDeviceOnThingspeak.message,
          errors,
        };
      }
    } catch (e) {
      logger.error(`update -- ${e.message}`);
      return {
        success: false,
        message: "",
        errors: e.message,
      };
    }
  },
  delete: async (request) => {
    try {
      return {
        success: false,
        message: "feature temporarity disabled --coming soon",
        status: HTTPStatus.SERVICE_UNAVAILABLE,
      };
      const { device_number } = request.query;
      let modifiedRequest = request;
      if (isEmpty(device_number)) {
        logger.info(`the device_number is not present`);
        let responseFromListDevice = await registerDeviceUtil.list(request);
        logger.info(
          `responseFromListDevice -- ${jsonify(responseFromListDevice)}`
        );
        if (!responseFromListDevice.success) {
          let errors = responseFromListDevice.errors
            ? responseFromListDevice.errors
            : "";
          return {
            success: false,
            message: responseFromListDevice.message,
            errors,
          };
        }
        let device_number = responseFromListDevice.data[0].device_number;
        logger.info(`device_number -- ${device_number}`);
        modifiedRequest["query"]["device_number"] = device_number;
      }
      logger.info(`the modifiedRequest -- ${modifiedRequest} `);
      logObject("the UnModifiedRequest ", jsonify(request));

      let responseFromDeleteDeviceFromThingspeak = await registerDeviceUtil.deleteOnThingspeak(
        modifiedRequest
      );

      logger.info(
        `responseFromDeleteDeviceFromThingspeak -- ${jsonify(
          responseFromDeleteDeviceFromThingspeak
        )}`
      );
      if (responseFromDeleteDeviceFromThingspeak.success) {
        let responseFromDeleteDeviceOnPlatform = await registerDeviceUtil.deleteOnPlatform(
          modifiedRequest
        );

        logger.info(
          `responseFromDeleteDeviceOnPlatform -- ${jsonify(
            responseFromDeleteDeviceOnPlatform
          )}`
        );

        if (responseFromDeleteDeviceOnPlatform.success === true) {
          return {
            success: true,
            message: responseFromDeleteDeviceOnPlatform.message,
            data: responseFromDeleteDeviceOnPlatform.data,
          };
        }

        if (responseFromDeleteDeviceOnPlatform.success === false) {
          let errors = responseFromDeleteDeviceOnPlatform.errors
            ? responseFromDeleteDeviceOnPlatform.errors
            : "";
          return {
            success: false,
            message: responseFromDeleteDeviceOnPlatform.message,
            errors,
          };
        }
      }

      if (responseFromDeleteDeviceFromThingspeak.success === false) {
        let errors = responseFromDeleteDeviceFromThingspeak.errors
          ? responseFromDeleteDeviceFromThingspeak.errors
          : "";
        let status = parseInt(
          `${
            responseFromDeleteDeviceFromThingspeak.status
              ? responseFromDeleteDeviceFromThingspeak.status
              : ""
          }`
        );
        return {
          success: false,
          message: responseFromDeleteDeviceFromThingspeak.message,
          errors,
          status,
        };
      }
    } catch (e) {
      logger.error(`delete -- ${e.message}`);
      return {
        success: false,
        message: "server error --delete -- create-device util",
        errors: e.message,
      };
    }
  },
  list: async (request) => {
    try {
      let { tenant } = request.query;
      const limit = parseInt(request.query.limit, 0);
      const skip = parseInt(request.query.skip, 0);
      let filter = {};
      let responseFromFilter = generateFilter.devices(request);
      logger.info(`responseFromFilter -- ${jsonify(responseFromFilter)}`);

      if (responseFromFilter.success === true) {
        logObject("the filter", responseFromFilter.data);
        filter = responseFromFilter.data;
        logger.info(`the filter in list -- ${jsonify(filter)}`);
      }

      if (responseFromFilter.success === false) {
        let errors = responseFromFilter.errors ? responseFromFilter.errors : "";
        logger.error(`the error from filter in list -- ${errors}`);
        return {
          success: false,
          message: responseFromFilter.message,
          errors,
        };
      }

      let responseFromListDevice = await getModelByTenant(
        tenant,
        "device",
        DeviceSchema
      ).list({
        filter,
        limit,
        skip,
      });

      logger.info(
        `the responseFromListDevice in list -- ${jsonify(
          responseFromListDevice
        )} `
      );

      if (responseFromListDevice.success === false) {
        let errors = responseFromListDevice.errors
          ? responseFromListDevice.errors
          : "";
        let status = responseFromListDevice.status
          ? responseFromListDevice.status
          : "";
        logger.error(
          `responseFromListDevice was not a success -- ${responseFromListDevice.message} -- ${errors}`
        );
        return {
          success: false,
          message: responseFromListDevice.message,
          errors,
          status,
        };
      }

      if (responseFromListDevice.success === true) {
        let data = responseFromListDevice.data;
        let status = responseFromListDevice.status
          ? responseFromListDevice.status
          : "";
        logger.info(`responseFromListDevice was a success -- ${data}`);
        return {
          success: true,
          message: responseFromListDevice.message,
          data,
          status,
        };
      }
    } catch (e) {
      logger.error(`error for list devices util -- ${e.message}`);
      return {
        success: false,
        message: "list devices util - server error",
        errors: e.message,
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  clear: (request) => {
    return {
      success: false,
      message: "coming soon...",
    };
  },

  createOnClarity: (request) => {
    return {
      message: "coming soon",
      success: false,
    };
  },

  createOnPlatform: async (request) => {
    try {
      logText("createOnPlatform util....");
      const { tenant } = request.query;
      const { body } = request;

      const responseFromRegisterDevice = await getModelByTenant(
        tenant,
        "device",
        DeviceSchema
      ).register(body);

      logObject("responseFromRegisterDevice", responseFromRegisterDevice);
      logger.info(
        `the responseFromRegisterDevice --${jsonify(
          responseFromRegisterDevice
        )} `
      );

      if (responseFromRegisterDevice.success === true) {
        return {
          success: true,
          data: responseFromRegisterDevice.data,
          message: responseFromRegisterDevice.message,
          status: responseFromRegisterDevice.status,
        };
      }

      if (responseFromRegisterDevice.success === false) {
        let errors = responseFromRegisterDevice.errors
          ? responseFromRegisterDevice.errors
          : "";

        return {
          success: false,
          message: responseFromRegisterDevice.message,
          errors,
          status: responseFromRegisterDevice.status,
        };
      }
    } catch (error) {
      logger.error("server error - createOnPlatform util");
      return {
        success: false,
        errors: error.message,
        message: "Internal Server Error",
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  createOnThingSpeak: async (request) => {
    try {
      const baseURL = constants.CREATE_THING_URL;
      const { body } = request;
      const data = body;
      const map = constants.DEVICE_THINGSPEAK_MAPPINGS;
      const context = constants.THINGSPEAK_FIELD_DESCRIPTIONS;
      logger.info(`the context -- ${jsonify(context)}`);
      const responseFromTransformRequestBody = await registerDeviceUtil.transform(
        {
          data,
          map,
          context,
        }
      );
      logger.info(
        `responseFromTransformRequestBody -- ${jsonify(
          responseFromTransformRequestBody
        )}`
      );
      let transformedBody = responseFromTransformRequestBody.success
        ? responseFromTransformRequestBody.data
        : {};

      if (isEmpty(transformedBody)) {
        return {
          success: false,
          message: responseFromTransformRequestBody.message,
        };
      }
      const response = await axios.post(baseURL, transformedBody);

      if (isEmpty(response)) {
        return {
          success: false,
          message: "unable to create the device on thingspeak",
        };
      }

      let writeKey = response.data.api_keys[0].write_flag
        ? response.data.api_keys[0].api_key
        : "";
      let readKey = !response.data.api_keys[1].write_flag
        ? response.data.api_keys[1].api_key
        : "";

      let newChannel = {
        device_number: `${response.data.id}`,
        writeKey: writeKey,
        readKey: readKey,
      };

      return {
        success: true,
        message: "successfully created the device on thingspeak",
        data: newChannel,
      };
    } catch (error) {
      logger.error(` createOnThingSpeak -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
        errors: error.message,
      };
    }
  },

  updateOnThingspeak: async (request) => {
    try {
      logger.info(`  updateOnThingspeak's request -- ${jsonify(request)}`);
      const { device_number } = request.query;
      const { body } = request;
      const config = {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      };
      const data = body;
      const map = constants.DEVICE_THINGSPEAK_MAPPINGS;
      const context = constants.THINGSPEAK_FIELD_DESCRIPTIONS;
      logger.info(`the context -- ${jsonify(context)}`);
      const responseFromTransformRequestBody = await registerDeviceUtil.transform(
        {
          data,
          map,
        }
      );
      logger.info(
        `responseFromTransformRequestBody -- ${jsonify(
          responseFromTransformRequestBody
        )}`
      );
      let transformedBody = responseFromTransformRequestBody.success
        ? responseFromTransformRequestBody.data
        : {};

      logger.info(`transformedBody -- ${jsonify(transformedBody)}`);
      if (isEmpty(transformedBody)) {
        return {
          success: false,
          message: responseFromTransformRequestBody.message,
        };
      }
      const response = await axios.put(
        constants.UPDATE_THING(device_number),
        qs.stringify(transformedBody),
        config
      );
      if (isEmpty(response)) {
        return {
          success: false,
          message: "unable to update the device_number on thingspeak",
        };
      }
      logger.info(`successfully updated the device on thingspeak`);
      return {
        success: true,
        message: "successfully updated the device on thingspeak",
        data: response.data,
      };
    } catch (error) {
      logger.error(`updateOnThingspeak util -- ${error.message}`);
      utillErrors.tryCatchErrors(
        error,
        "server error - updateOnThingspeak util"
      );
    }
  },
  updateOnClarity: (request) => {
    return {
      success: false,
      message: "coming soon...",
      errors: "not yet integrated with the clarity system",
    };
  },
  updateOnPlatform: async (request) => {
    try {
      const { id, device_number, name, tenant } = request.query;
      const { body } = request;
      logObject("The request", request);
      let update = body;
      let filter = {};
      let responseFromFilter = generateFilter.devices(request);
      logElement(
        "is responseFromFilter in util a success?",
        responseFromFilter.success
      );
      logger.info(`the filter ${jsonify(responseFromFilter.data)}`);
      if (responseFromFilter.success === true) {
        logObject("the filter", responseFromFilter.data);
        filter = responseFromFilter.data;
      }

      if (responseFromFilter.success === false) {
        let errors = responseFromFilter.errors ? responseFromFilter.errors : "";
        logger.error(
          `responseFromFilter.error in create-device util--${responseFromFilter.errors}`
        );
        return {
          success: false,
          message: responseFromFilter.message,
          errors,
        };
      }
      let responseFromModifyDevice = await getModelByTenant(
        tenant,
        "device",
        DeviceSchema
      ).modify({ filter, update });

      if (responseFromModifyDevice.success === true) {
        return {
          success: true,
          message: responseFromModifyDevice.message,
          data: responseFromModifyDevice.data,
        };
      }

      if (responseFromModifyDevice.success === false) {
        let errors = responseFromModifyDevice.errors
          ? responseFromModifyDevice.errors
          : "";
        return {
          success: false,
          message: responseFromModifyDevice.message,
          errors,
        };
      }
    } catch (error) {
      logger.error(`updateOnPlatform util -- ${error.message}`);
      utillErrors.tryCatchErrors(error, "server error - updateOnPlatform util");
    }
  },
  deleteOnThingspeak: async (request) => {
    try {
      let device_number = parseInt(request.query.device_number, 10);
      logger.info(`the device_number -- ${device_number}`);
      let response = await axios
        .delete(`${constants.DELETE_THING_URL(device_number)}`)
        .catch((e) => {
          logger.error(`error.response.data -- ${e.response.data}`);
          logger.error(`error.response.status -- ${e.response.status}`);
          logger.error(`error.response.headers -- ${e.response.headers}`);
          if (e.response) {
            let errors = e.response.data.error;
            let status = e.response.data.status;
            return {
              success: false,
              errors,
              status,
              message:
                "device does not exist on external system, consider SOFT delete",
            };
          }
        });

      if (!isEmpty(response.success) && !response.success) {
        logger.info(`the response from thingspeak -- ${jsonify(response)}`);
        return {
          success: false,
          message: `${response.message}`,
          errors: `${response.error}`,
          status: `${response.status}`,
        };
      }
      if (!isEmpty(response.data)) {
        logger.info(
          `successfully deleted the device on thingspeak -- ${jsonify(
            response.data
          )}`
        );
        return {
          success: true,
          message: "successfully deleted the device on thingspeak",
          data: response.data,
        };
      }
    } catch (error) {
      logger.error(`deleteOnThingspeak -- ${error.message}`);
      utillErrors.tryCatchErrors(error, "server error - updateOnPlatform util");
    }
  },
  deleteOnPlatform: async (request) => {
    try {
      const { tenant } = request.query;
      logger.info(
        `the requesting coming into deleteOnPlatform util --${request}`
      );
      let filter = {};
      let responseFromFilter = generateFilter.devices(request);
      if (responseFromFilter.success == true) {
        logger.info(`the filter ${jsonify(responseFromFilter.data)}`);
        filter = responseFromFilter.data;
      }

      if (responseFromFilter.success == false) {
        let errors = responseFromFilter.errors ? responseFromFilter.errors : "";
        logger.error(
          `responseFromFilter.error in create-device util--${responseFromFilter.errors}`
        );
        return {
          success: false,
          message: responseFromFilter.message,
          errors,
        };
      }
      let responseFromRemoveDevice = await getModelByTenant(
        tenant,
        "device",
        DeviceSchema
      ).remove({ filter });

      logger.info(
        `responseFromRemoveDevice --- ${jsonify(responseFromRemoveDevice)}`
      );
      if (responseFromRemoveDevice.success == true) {
        return {
          success: true,
          message: responseFromRemoveDevice.message,
          data: responseFromRemoveDevice.data,
        };
      }

      if (responseFromRemoveDevice.success == false) {
        let errors = responseFromRemoveDevice.errors
          ? responseFromRemoveDevice.errors
          : "";
        return {
          success: false,
          message: responseFromRemoveDevice.message,
          errors,
        };
      }
    } catch (error) {
      logger.error(`updateOnPlatform util -- ${error.message}`);
      utillErrors.badRequest("updateOnPlatform util", error.message);
    }
  },
  deleteOnclarity: (request) => {
    return {
      success: false,
      message: "coming soon",
      errors: "not yet integrated with the clarity system",
    };
  },

  decryptKey: (encryptedKey) => {
    try {
      logText("we are inside the decrypt key");
      let bytes = cryptoJS.AES.decrypt(
        encryptedKey,
        constants.KEY_ENCRYPTION_KEY
      );
      let originalText = bytes.toString(cryptoJS.enc.Utf8);
      return {
        success: true,
        message: "successfully decrypted the text",
        data: originalText,
      };
    } catch (err) {
      logObject("the err", err);
      return {
        success: false,
        message: "unable to decrypt the key",
        errors: err.message,
      };
    }
  },
  transform: ({ data = {}, map = {}, context = {} } = {}) => {
    try {
      const result = transform(data, map, context);
      if (!isEmpty(result)) {
        return {
          success: true,
          message: "successfully transformed the json request",
          data: result,
        };
      } else {
        logger.warn(
          `the request body for the external system is empty after transformation`
        );
        return {
          success: true,
          message:
            "the request body for the external system is empty after transformation",
          data: result,
        };
      }
    } catch (error) {
      logger.error(`transform -- ${error.message}`);
      return {
        success: false,
        message: "server error - trasform util",
        errors: error.message,
      };
    }
  },
};

/********************************** older code **************************** */
const createOnThingSpeak = async (
  req,
  res,
  baseUrl,
  prepBodyTS,
  channel,
  device,
  deviceBody,
  tenant
) => {
  await axios
    .post(baseUrl, prepBodyTS)
    .then(async (response) => {
      channel = response.data.id;
      logText("device successfully created on TS.");
      let writeKey = response.data.api_keys[0].write_flag
        ? response.data.api_keys[0].api_key
        : "";
      let readKey = !response.data.api_keys[1].write_flag
        ? response.data.api_keys[1].api_key
        : "";
      let prepBodyDeviceModel = {
        ...deviceBody,
        channelID: `${response.data.id}`,
        writeKey: writeKey,
        readKey: readKey,
      };
      logText("adding the device to the platform...");
      await createDevice(tenant, prepBodyDeviceModel, req, res);
    })
    .catch(async (e) => {
      logElement(
        "unable to create device on the platform, attempting to delete it from TS",
        e.message
      );
      let error = e.message;
      await deleteChannel(channel, device, error, req, res);
    });
};

const createOnClarity = (tenant, req, res) => {
  return res.status(HTTPStatus.TEMPORARY_REDIRECT).json({
    message: `temporary redirect, device creation for this organisation (${tenant}) not yet enabled/integrated`,
    success: false,
  });
};

const createDevice = async (tenant, prepBodyDeviceModel, req, res) => {
  const device = await getModelByTenant(
    tenant,
    "device",
    DeviceSchema
  ).createDevice(prepBodyDeviceModel);
  logElement("DB addition response", device);
  return res.status(HTTPStatus.CREATED).json({
    success: true,
    message: "successfully created the device",
    device,
  });
};

module.exports = {
  createDevice,
  createOnThingSpeak,
  createOnClarity,
  registerDeviceUtil,
};
