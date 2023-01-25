const { logElement, logObject, logText } = require("@utils/log");
const mongoose = require("mongoose").set("debug", true);
const ObjectId = mongoose.Types.ObjectId;
const httpStatus = require("http-status");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- generate-filter-util`
);

const filter = {
  users: (req) => {
    try {
      let { privilege, id, username, active, email_address, role_id } =
        req.query;
      let { email, resetPasswordToken, user } = req.body;
      const { user_id } = req.params;
      let filter = {};
      if (email) {
        filter["email"] = email;
      }

      if (role_id) {
        filter["role"] = ObjectId(role_id);
      }

      if (email_address) {
        filter["email"] = email_address;
      }
      if (resetPasswordToken) {
        filter["resetPasswordToken"] = resetPasswordToken;
        filter["resetPasswordExpires"] = {
          $gt: Date.now(),
        };
      }
      if (privilege) {
        filter["privilege"] = privilege;
      }
      if (id) {
        filter["_id"] = ObjectId(id);
      }
      if (user_id) {
        filter["_id"] = ObjectId(user_id);
      }
      if (user) {
        filter["_id"] = ObjectId(user);
      }
      if (active) {
        if (active === "yes") {
          filter["isActive"] = true;
        } else if (active === "no") {
          filter["isActive"] = false;
        }
      }
      if (username) {
        filter["userName"] = username;
      }
      return {
        success: true,
        message: "successfully created the filter",
        data: filter,
      };
    } catch (e) {
      return {
        success: false,
        message: "filter util server error",
        error: e.message,
      };
    }
  },
  networks: (req) => {
    try {
      const {
        net_email,
        net_category,
        net_tenant,
        net_status,
        net_phoneNumber,
        net_website,
        net_acronym,
      } = req.query;

      const { net_id } = req.params;

      let filter = {};
      if (net_email) {
        filter["net_email"] = net_email;
      }
      if (net_category) {
        filter["net_category"] = net_category;
      }

      if (net_id) {
        filter["_id"] = ObjectId(net_id);
      }

      if (net_tenant) {
        filter["net_tenant"] = net_tenant;
      }
      if (net_acronym) {
        filter["net_acronym"] = net_acronym;
      }

      if (net_phoneNumber) {
        filter["net_phoneNumber"] = net_phoneNumber;
      }
      if (net_website) {
        filter["net_website"] = net_website;
      }
      if (net_status) {
        filter["net_status"] = net_status;
      }

      return {
        success: true,
        message: "successfully created the filter",
        data: filter,
      };
    } catch (err) {
      return {
        success: false,
        message: "filter util server error",
        errors: { message: err.message },
      };
    }
  },
  candidates: (req) => {
    try {
      let { category, id, email_address } = req.query;
      let { email } = req.body;
      let filter = {};
      if (email) {
        filter["email"] = email;
      }
      if (email_address) {
        filter["email"] = email_address;
      }
      if (category) {
        filter["category"] = category;
      }
      if (id) {
        filter["_id"] = id;
      }
      return {
        success: true,
        message: "successfully created the filter",
        data: filter,
      };
    } catch (e) {
      return {
        success: false,
        message: "filter util server error",
        error: e.message,
      };
    }
  },

  defaults: (req) => {
    try {
      let { id, user, site, airqloud } = req.query;
      let filter = {};
      if (user) {
        filter["user"] = ObjectId(user);
      }
      if (id) {
        filter["_id"] = ObjectId(id);
      }
      if (site) {
        filter["site"] = ObjectId(site);
      }

      if (airqloud) {
        filter["airqloud"] = ObjectId(airqloud);
      }

      return {
        success: true,
        message: "successfully created the filter",
        data: filter,
      };
    } catch (e) {
      return {
        success: false,
        message: "filter util server error",
        error: e.message,
      };
    }
  },

  inquiry: (req) => {
    try {
      let { category, id } = req.query;
      let { email } = req.body;
      let filter = {};
      if (email) {
        filter["email"] = email;
      }
      if (category) {
        filter["category"] = category;
      }
      if (id) {
        filter["_id"] = id;
      }
      return {
        success: true,
        message: "successfully created the filter",
        data: filter,
      };
    } catch (e) {
      return {
        success: false,
        message: "filter util server error",
        error: e.message,
      };
    }
  },

  defaults_v2: (req) => {
    try {
      let { id, user, user_id, airqloud, airqloud_id, site, site_id } =
        req.query;
      let filter = {
        site_ids: {},
        sites: {},
        airqloud_ids: {},
        airqlouds: {},
      };

      /*** user id */
      if (user) {
        filter["user"] = ObjectId(user);
      }
      if (id) {
        filter["_id"] = ObjectId(id);
      }
      if (user_id) {
        filter["user_id"] = ObjectId(user_id);
      }

      /** airqloud_id */
      if (airqloud_id) {
        let airqloudIdArray = airqloud_id.split(",");
        let modifiedAirQloudIdArray = airqloudIdArray.map((airqloud_id) => {
          return ObjectId(airqloud_id);
        });
        filter["airqloud_ids"]["$in"] = modifiedAirQloudIdArray;
      }

      if (!airqloud_id) {
        delete filter["airqloud_ids"];
      }

      /*** airqloud */
      if (airqloud) {
        filter["airqlouds"] = airqloud;
      }
      if (!airqloud) {
        delete filter["airqlouds"];
      }

      /**
       * site_id
       */
      if (site_id) {
        let siteIdArray = site_id.split(",");
        let modifiedSiteIdArray = siteIdArray.map((site_id) => {
          return ObjectId(site_id);
        });
        filter["site_ids"]["$in"] = modifiedSiteIdArray;
      }

      if (!site_id) {
        delete filter["site_ids"];
      }

      /** site */
      if (site) {
        let siteArray = site.split(",");
        filter["sites"]["$in"] = siteArray;
      }

      if (!site) {
        delete filter["sites"];
      }

      return {
        success: true,
        message: "successfully created the filter",
        data: filter,
      };
    } catch (e) {
      return {
        success: false,
        message: "filter util server error",
        error: e.message,
      };
    }
  },

  roles: (req) => {
    try {
      const { query, params } = req;
      const { id, name, network } = query;
      const { role_id } = params;
      let filter = {};

      if (id) {
        filter["_id"] = ObjectId(id);
      }

      if (role_id) {
        logText("we have the role ID");
        filter["_id"] = ObjectId(role_id);
      }

      if (network) {
        filter["network_id"] = network;
      }
      if (name) {
        filter["name"] = name;
      }
      return filter;
    } catch (e) {
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: e.message },
      };
    }
  },

  permissions: (req) => {
    try {
      const { query, params } = req;
      const { id, network, permission } = query;
      const { permission_id, network_id } = params;
      let filter = {};

      if (id) {
        filter["_id"] = ObjectId(id);
      }

      if (permission_id) {
        filter["permission"] = permission_id;
      }

      if (network) {
        filter["network_id"] = ObjectId(network);
      }

      if (network_id) {
        filter["network_id"] = ObjectId(network_id);
      }

      if (permission) {
        filter["permission"] = permission;
      }

      return filter;
    } catch (e) {
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: e.message },
      };
    }
  },

  tokens: (req) => {
    try {
      const { query, params } = req;
      const { id } = query;
      const { token, user_id, network_id, client_id } = params;
      let filter = {};

      if (id) {
        filter["_id"] = ObjectId(id);
      }

      if (token) {
        filter["token"] = token;
      }

      if (client_id) {
        filter["client_id"] = client_id;
      }

      if (network_id) {
        filter["network_id"] = ObjectId(network_id);
      }

      if (user_id) {
        filter[" user_id"] = ObjectId(user_id);
      }
      return filter;
    } catch (e) {
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: e.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  clients: (req) => {
    try {
      const { query, params } = req;
      const { id } = query;
      const { client_id, client_name, network_id, client_secret } = params;
      let filter = {};

      if (id) {
        filter["_id"] = ObjectId(id);
      }

      if (client_id) {
        filter["client_id"] = client_id;
      }

      if (client_secret) {
        filter["client_secret"] = client_secret;
      }

      if (client_name) {
        filter["name"] = client_name;
      }

      if (network_id) {
        const networksArray = network_id.split(",");
        const arrayOfNetworkObjects = networksArray.map((value) => {
          ObjectId(value);
        });
        filter["networks"] = {};
        filter["networks"]["$in"] = arrayOfNetworkObjects;
      }

      return filter;
    } catch (e) {
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: e.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  scopes: (req) => {
    try {
      const { query, params } = req;
      const { id, scope } = query;
      const { scope_id, network_id } = params;
      let filter = {};

      if (id) {
        filter["_id"] = ObjectId(id);
      }

      if (scope_id) {
        filter["scope"] = scope_id;
      }

      if (scope) {
        filter["scope"] = scope;
      }

      if (network_id) {
        filter["network_id"] = ObjectId(network_id);
      }
      return filter;
    } catch (e) {
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: e.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  departments: (req) => {
    try {
      const {
        dep_email,
        dep_title,
        dep_network_id,
        dep_parent,
        dep_manager,
        has_children,
        dep_acronym,
        dep_children,
      } = req.query;

      const { dep_id, usr_id } = req.params;

      let filter = {};

      if (dep_id) {
        filter["_id"] = ObjectId(dep_id);
      }

      if (dep_status) {
        filter["net_status"] = net_status;
      }

      return {
        success: true,
        message: "successfully created the filter",
        data: filter,
      };
    } catch (err) {
      return {
        success: false,
        message: "filter util server error",
        errors: { message: err.message },
      };
    }
  },
};

module.exports = filter;
