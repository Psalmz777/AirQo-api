import os
import pandas as pd
import numpy as np
from sklearn.multiclass import OneVsRestClassifier
from catboost import CatBoostClassifier
import pickle
from dotenv import load_dotenv, find_dotenv
import datetime
from pathlib import Path

load_dotenv(find_dotenv())

BASE_DIR = Path(__file__).resolve().parent
CATBOOST_MODEL = os.getenv('CATBOOST_MODEL','jobs/catboost_model.pkl')

class Classification():
    def predict_faults(self, model_inputs):
    
        map_columns = {
            "time": "Datetime",
            "pm2.5": "Sensor1_PM2.5",
            "S2_pm2.5": "Sensor2_PM2.5"
        }
        
        model_inputs = pd.DataFrame(model_inputs)
        model_inputs.rename(columns=map_columns, inplace = True)

        model_inputs["Datetime"] = pd.to_datetime(model_inputs.Datetime)
        model_inputs['Datetime_day'] = model_inputs.Datetime.dt.day
        model_inputs['Datetime_month'] = model_inputs.Datetime.dt.month
        model_inputs['Datetime_hour'] = model_inputs.Datetime.dt.hour

        model_inputs["Sensor difference"] = (model_inputs["Sensor1_PM2.5"] - model_inputs["Sensor2_PM2.5"]).abs()
        model_inputs["Sensor div"] = (model_inputs["Sensor1_PM2.5"] / model_inputs["Sensor2_PM2.5"]).abs()
        model_inputs["Mean"] = model_inputs[["Sensor1_PM2.5","Sensor2_PM2.5"]].mean(axis=1)
        model_inputs["Var"] = model_inputs[["Sensor1_PM2.5","Sensor2_PM2.5"]].var(axis=1)

        classifier = pickle.load(open(str(CATBOOST_MODEL), 'rb'))
        predicted_faults = classifier.predict(model_inputs)
        faults_df = pd.DataFrame(predicted_faults, columns= ["Offset_fault","Out_of_bounds_fault","Data_loss_fault", "High_variance_fault"])
        
        model_output = model_inputs[["Datetime", "Sensor1_PM2.5","Sensor2_PM2.5"]].join(faults_df)

        return model_output


if __name__ == "__main__":
    predictFault = Classification()
#     print(predictFault.predict_faults([
#     {
#         "time":datetime.datetime(2021, 3, 31, 11, 5, 21),
#         "pm2.5": np.NaN,
#         "S2_pm2.5": 4.5
#     },
#     {
#         "time":datetime.datetime(2021, 3, 31, 11, 5, 21),
#         "pm2.5": 3.5,
#         "S2_pm2.5": 4.5
#     }
# ]))